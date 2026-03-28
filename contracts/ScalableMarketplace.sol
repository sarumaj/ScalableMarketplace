// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title ScalableMarketplace
 * @dev Demonstrates scalability patterns for zkEVM
 */
contract ScalableMarketplace {
    // Use mappings for O(1) lookups instead of arrays
    mapping(uint256 => Item) public items;
    mapping(address => uint256[]) private userItems;  // User's item IDs
    mapping(address => uint256) public userBalance;
    
    uint256 public itemCount;
    uint256 public constant MAX_BATCH_SIZE = 100;
    
    struct Item {
        uint256 id;
        address seller;
        string name;
        uint256 price;
        bool sold;
    }

    // Events for off-chain indexing (The Graph, etc.)
    event ItemListed(uint256 indexed itemId, address indexed seller, uint256 price);
    event ItemSold(uint256 indexed itemId, address indexed buyer, address indexed seller);
    event BatchProcessed(uint256 count, uint256 timestamp);
    
    modifier validBatchSize(uint256 size) {
        require(size > 0 && size <= MAX_BATCH_SIZE, "Invalid batch size");
        _;
    }

    /**
     * @dev List single item (basic operation)
     */
    function listItem(string calldata name, uint256 price) external returns (uint256) {
        require(price > 0, "Price must be positive");
        
        uint256 itemId = itemCount++;
        
        items[itemId] = Item({
            id: itemId,
            seller: msg.sender,
            name: name,
            price: price,
            sold: false
        });
        
        userItems[msg.sender].push(itemId);
        
        emit ItemListed(itemId, msg.sender, price);
        
        return itemId;
    }
    
    /**
     * @dev Batch list items - SCALABILITY PATTERN
     * Lists multiple items in one transaction
     * Saves gas and reduces blockchain load
     */
    function batchListItems(
        string[] calldata names,
        uint256[] calldata prices
    ) external validBatchSize(names.length) returns (uint256[] memory) {
        require(names.length == prices.length, "Array length mismatch");
        
        uint256[] memory itemIds = new uint256[](names.length);
        
        for (uint256 i = 0; i < names.length; i++) {
            require(prices[i] > 0, "Price must be positive");
            
            uint256 itemId = itemCount++;
            
            items[itemId] = Item({
                id: itemId,
                seller: msg.sender,
                name: names[i],
                price: prices[i],
                sold: false
            });
            
            userItems[msg.sender].push(itemId);
            itemIds[i] = itemId;
            
            emit ItemListed(itemId, msg.sender, prices[i]);
        }
        
        emit BatchProcessed(names.length, block.timestamp);
        
        return itemIds;
    }

    /**
     * @dev Buy item with balance
     */
    function buyItem(uint256 itemId) external payable {
        Item storage item = items[itemId];
        
        require(!item.sold, "Item already sold");
        require(msg.value == item.price, "Incorrect payment");
        require(item.seller != msg.sender, "Cannot buy own item");
        
        item.sold = true;
        userBalance[item.seller] += msg.value;
        
        emit ItemSold(itemId, msg.sender, item.seller);
    }

    /**
     * @dev Batch buy items - SCALABILITY PATTERN
     */
    function batchBuyItems(uint256[] calldata itemIds) 
        external 
        payable 
        validBatchSize(itemIds.length) 
    {
        uint256 totalPrice = 0;
        
        // First pass: validate and calculate total
        for (uint256 i = 0; i < itemIds.length; i++) {
            Item storage item = items[itemIds[i]];
            require(!item.sold, "Item already sold");
            require(item.seller != msg.sender, "Cannot buy own item");
            totalPrice += item.price;
        }
        
        require(msg.value == totalPrice, "Incorrect payment");
        
        // Second pass: execute purchases
        for (uint256 i = 0; i < itemIds.length; i++) {
            Item storage item = items[itemIds[i]];
            item.sold = true;
            userBalance[item.seller] += item.price;
            
            emit ItemSold(itemIds[i], msg.sender, item.seller);
        }
        
        emit BatchProcessed(itemIds.length, block.timestamp);
    }
    
    /**
     * @dev Withdraw seller balance
     */
    function withdraw() external {
        uint256 balance = userBalance[msg.sender];
        require(balance > 0, "No balance to withdraw");
        
        userBalance[msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @dev Get user's items - SCALABILITY PATTERN
     * Returns array of IDs for off-chain processing
     */
    function getUserItems(address user) external view returns (uint256[] memory) {
        return userItems[user];
    }
    
    /**
     * @dev Batch get items - SCALABILITY PATTERN
     * Retrieve multiple items in one call
     */
    function batchGetItems(uint256[] calldata itemIds) 
        external 
        view 
        returns (Item[] memory) 
    {
        Item[] memory result = new Item[](itemIds.length);
        
        for (uint256 i = 0; i < itemIds.length; i++) {
            result[i] = items[itemIds[i]];
        }
        
        return result;
    }
}
