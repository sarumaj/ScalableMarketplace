import { expect } from "chai";
import hardhat from "hardhat";
const { ethers } = hardhat;

describe("ScalableMarketplace", function () {
  let marketplace, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const Marketplace = await ethers.getContractFactory("ScalableMarketplace");
    marketplace = await Marketplace.deploy();
    await marketplace.waitForDeployment();
  });

  it("should list a single item", async function () {
    const tx = await marketplace.connect(user1).listItem("Item1", 100);
    const receipt = await tx.wait();
    const itemId = receipt.logs[0].args.itemId;
    const item = await marketplace.items(itemId);
    expect(item.name).to.equal("Item1");
    expect(item.price).to.equal(100);
    expect(item.seller).to.equal(user1.address);
    expect(item.sold).to.equal(false);
  });

  it("should batch list items", async function () {
    const names = ["A", "B", "C"];
    const prices = [10, 20, 30];
    const tx = await marketplace.connect(user1).batchListItems(names, prices);
    const receipt = await tx.wait();
    // Check event and items
    for (let i = 0; i < names.length; i++) {
      const item = await marketplace.items(i);
      expect(item.name).to.equal(names[i]);
      expect(item.price).to.equal(prices[i]);
      expect(item.seller).to.equal(user1.address);
      expect(item.sold).to.equal(false);
    }
  });

  it("should buy an item", async function () {
    await marketplace.connect(user1).listItem("Item1", 100);
    await expect(marketplace.connect(user2).buyItem(0, { value: 100 })).to.emit(
      marketplace,
      "ItemSold"
    );
    const item = await marketplace.items(0);
    expect(item.sold).to.equal(true);
    expect(await marketplace.userBalance(user1.address)).to.equal(100);
  });

  it("should batch buy items", async function () {
    await marketplace.connect(user1).batchListItems(["A", "B"], [10, 20]);
    await expect(
      marketplace.connect(user2).batchBuyItems([0, 1], { value: 30 })
    ).to.emit(marketplace, "BatchProcessed");
    expect((await marketplace.items(0)).sold).to.equal(true);
    expect((await marketplace.items(1)).sold).to.equal(true);
    expect(await marketplace.userBalance(user1.address)).to.equal(30);
  });

  it("should withdraw balance", async function () {
    await marketplace.connect(user1).listItem("Item1", 100);
    await marketplace.connect(user2).buyItem(0, { value: 100 });
    const before = await ethers.provider.getBalance(user1.address);
    const tx = await marketplace.connect(user1).withdraw();
    const receipt = await tx.wait();
    const after = await ethers.provider.getBalance(user1.address);
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    // The withdrawn amount is 100, so after + gasUsed - before should be close to 100
    const delta = after + gasUsed - before;
    expect(delta).to.be.closeTo(100n, 10_000_000_000_000n);
    expect(await marketplace.userBalance(user1.address)).to.equal(0);
  });

  it("should get user items", async function () {
    await marketplace.connect(user1).batchListItems(["A", "B"], [10, 20]);
    const items = await marketplace.getUserItems(user1.address);
    expect(items.length).to.equal(2);
    expect(items[0]).to.equal(0);
    expect(items[1]).to.equal(1);
  });

  it("should batch get items", async function () {
    await marketplace.connect(user1).batchListItems(["A", "B"], [10, 20]);
    const items = await marketplace.batchGetItems([0, 1]);
    expect(items[0].name).to.equal("A");
    expect(items[1].name).to.equal("B");
  });

  it("should revert on invalid batch size", async function () {
    const names = Array(101).fill("A");
    const prices = Array(101).fill(1);
    await expect(
      marketplace.connect(user1).batchListItems(names, prices)
    ).to.be.revertedWith("Invalid batch size");
  });

  it("should revert if buying own item", async function () {
    await marketplace.connect(user1).listItem("Item1", 100);
    await expect(
      marketplace.connect(user1).buyItem(0, { value: 100 })
    ).to.be.revertedWith("Cannot buy own item");
  });

  it("should revert if price is incorrect", async function () {
    await marketplace.connect(user1).listItem("Item1", 100);
    await expect(
      marketplace.connect(user2).buyItem(0, { value: 99 })
    ).to.be.revertedWith("Incorrect payment");
  });

  it("should revert if item already sold", async function () {
    await marketplace.connect(user1).listItem("Item1", 100);
    await marketplace.connect(user2).buyItem(0, { value: 100 });
    await expect(
      marketplace.connect(user2).buyItem(0, { value: 100 })
    ).to.be.revertedWith("Item already sold");
  });

  it("should revert withdraw if no balance", async function () {
    await expect(marketplace.connect(user1).withdraw()).to.be.revertedWith(
      "No balance to withdraw"
    );
  });
});
