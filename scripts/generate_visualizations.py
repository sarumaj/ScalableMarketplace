#!/usr/bin/env python3
"""
Generate visualizations for blockchain scalability analysis.

This script creates charts for the assignment from benchmark results and live RPC data.

Usage:
    python generate_visualizations.py [options]

Requirements:
    pip install matplotlib numpy
"""

import argparse
import json
from pathlib import Path
from typing import Any, TypedDict, cast
from urllib import request

import matplotlib.pyplot as _plt
import numpy as _np

plt: Any = _plt
np: Any = _np


class BenchmarkData(TypedDict):
    gas_list_single: int
    gas_batch_list_3: int
    gas_buy_single: int
    gas_batch_buy_3: int
    gas_withdraw: int
    batch_sizes: list[int]
    gas_total_listing: list[int]
    gas_total_buying: list[int]


class ParsedBatchRun(TypedDict):
    size: int
    listItem: int
    batchListItems: int
    buyItem: int
    batchBuyItems: int
    withdraw: int


class ChainMetrics(TypedDict):
    name: str
    chain_id: int
    gas_price_gwei: float
    avg_block_time_s: float
    tps: float


class L1L2Metadata(TypedDict):
    ethereum_chain_id: int
    zkevm_chain_id: int
    eth_usd: float


BENCHMARK_RESULTS_FILE = Path.cwd() / "benchmark_results.json"

ETHEREUM_RPC_URL = "https://ethereum.publicnode.com"
ZKEVM_RPC_URL = "https://rpc.cardona.zkevm-rpc.com"
COINGECKO_ETH_USD_URL = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"

METRIC_LOOKBACK_BLOCKS = 60
HTTP_TIMEOUT_SECONDS = 20
HTTP_USER_AGENT = "Mozilla/5.0 (compatible; ScalabilityVisualizer/1.0)"


def validate_data(benchmark_data: BenchmarkData) -> bool:
    """Validate loaded benchmark data."""
    if benchmark_data["gas_list_single"] <= 0 or benchmark_data["gas_batch_list_3"] <= 0:
        return False
    if len(benchmark_data["batch_sizes"]) == 0:
        return False
    if len(benchmark_data["batch_sizes"]) != len(benchmark_data["gas_total_listing"]):
        return False
    if len(benchmark_data["batch_sizes"]) != len(benchmark_data["gas_total_buying"]):
        return False
    return True


def _to_int(value: Any) -> int:
    """Best-effort integer conversion for benchmark fields."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _sanitize_identifier(value: str) -> str:
    """Build a filesystem-safe lowercase identifier from network key text."""
    sanitized = "".join(ch if ch.isalnum() else "_" for ch in value.strip().lower())
    return sanitized.strip("_") or "unknown_network"


def _is_local_network_key(network_key: str) -> bool:
    """Return True when network key represents local/dev chains."""
    lowered = network_key.strip().lower()
    local_prefixes = ("localhost:", "hardhat:", "127.0.0.1:")
    local_suffixes = (":1337", ":31337")
    return lowered.startswith(local_prefixes) or lowered.endswith(local_suffixes)


def _extract_benchmark_data_for_network(network_run: dict[str, Any]) -> BenchmarkData | None:
    """Extract chart-ready benchmark data from a single network run object."""
    by_batch_size = cast(dict[str, Any], network_run.get("byBatchSize", {}))
    if not by_batch_size:
        return None

    parsed: list[ParsedBatchRun] = []
    for size_str, run_data in by_batch_size.items():
        try:
            size = int(size_str)
        except ValueError:
            continue

        run_data_dict = cast(dict[str, Any], run_data)
        metrics = cast(dict[str, Any], run_data_dict.get("metrics") or {})
        parsed.append(
            {
                "size": size,
                "listItem": _to_int(metrics.get("listItem")),
                "batchListItems": _to_int(metrics.get("batchListItems")),
                "buyItem": _to_int(metrics.get("buyItem")),
                "batchBuyItems": _to_int(metrics.get("batchBuyItems")),
                "withdraw": _to_int(metrics.get("withdraw")),
            }
        )

    parsed = [row for row in parsed if row["size"] > 0]
    if not parsed:
        return None

    parsed.sort(key=lambda row: row["size"])

    # Use batch size 3 run for operation-comparison chart if available.
    run_size_3 = next((row for row in parsed if row["size"] == 3), parsed[0])

    return {
        "gas_list_single": run_size_3["listItem"],
        "gas_batch_list_3": run_size_3["batchListItems"],
        "gas_buy_single": run_size_3["buyItem"],
        "gas_batch_buy_3": run_size_3["batchBuyItems"],
        "gas_withdraw": run_size_3["withdraw"],
        "batch_sizes": [row["size"] for row in parsed],
        "gas_total_listing": [row["batchListItems"] for row in parsed],
        "gas_total_buying": [row["batchBuyItems"] for row in parsed],
    }


def load_all_benchmark_data_from_file(
    benchmark_results_file: Path,
) -> dict[str, BenchmarkData] | None:
    """Load benchmark data for all available network keys from benchmark file."""

    if not benchmark_results_file.exists():
        return None

    with benchmark_results_file.open("r", encoding="utf-8") as handle:
        data = cast(dict[str, Any], json.load(handle))

    runs = cast(dict[str, Any], data.get("runs", {}))
    if not runs:
        return None

    all_data: dict[str, BenchmarkData] = {}
    for network_key, network_run in runs.items():
        network_data = _extract_benchmark_data_for_network(cast(dict[str, Any], network_run))
        if network_data and validate_data(network_data):
            all_data[network_key] = network_data

    return all_data or None


def rpc_call(url: str, method: str, params: list[Any] | None = None) -> Any:
    """Call a JSON-RPC endpoint and return the result field."""
    if params is None:
        params = []

    payload = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode("utf-8")
    req = request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": HTTP_USER_AGENT,
        },
        method="POST",
    )

    with request.urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as response:
        data = cast(dict[str, Any], json.loads(response.read().decode("utf-8")))

    if "error" in data:
        raise RuntimeError(f"RPC error for {method}: {data['error']}")

    return data.get("result")


def fetch_eth_usd_price() -> float:
    """Fetch ETH/USD spot price from CoinGecko."""
    req = request.Request(
        COINGECKO_ETH_USD_URL,
        headers={"User-Agent": HTTP_USER_AGENT},
        method="GET",
    )

    with request.urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as response:
        data = cast(dict[str, Any], json.loads(response.read().decode("utf-8")))

    ethereum = cast(dict[str, Any], data["ethereum"])
    return float(ethereum["usd"])


def sample_chain_metrics(name: str, rpc_url: str, lookback_blocks: int) -> ChainMetrics:
    """Sample gas price, average block time, and recent TPS for a chain."""
    chain_id_hex = cast(str, rpc_call(rpc_url, "eth_chainId"))
    gas_price_wei = int(cast(str, rpc_call(rpc_url, "eth_gasPrice")), 16)
    latest_block = int(cast(str, rpc_call(rpc_url, "eth_blockNumber")), 16)
    older_block = max(latest_block - lookback_blocks, 0)

    newest_block_data = cast(dict[str, Any], rpc_call(rpc_url, "eth_getBlockByNumber", [hex(latest_block), False]))
    older_block_data = cast(dict[str, Any], rpc_call(rpc_url, "eth_getBlockByNumber", [hex(older_block), False]))

    newest_ts = int(newest_block_data["timestamp"], 16)
    older_ts = int(older_block_data["timestamp"], 16)
    seconds = max(newest_ts - older_ts, 1)
    sampled_blocks = max(latest_block - older_block, 1)
    avg_block_time = seconds / sampled_blocks

    total_txs = 0
    for block_number in range(older_block + 1, latest_block + 1):
        block_data = cast(dict[str, Any], rpc_call(rpc_url, "eth_getBlockByNumber", [hex(block_number), False]))
        transactions = cast(list[Any], block_data["transactions"])
        total_txs += len(transactions)

    tps = total_txs / seconds

    return {
        "name": name,
        "chain_id": int(chain_id_hex, 16),
        "gas_price_gwei": gas_price_wei / 1e9,
        "avg_block_time_s": avg_block_time,
        "tps": tps,
    }


def collect_l1_l2_metrics(
    benchmark_data: BenchmarkData,
    ethereum_rpc_url: str,
    zkevm_rpc_url: str,
    lookback_blocks: int,
) -> tuple[list[float], list[float], L1L2Metadata]:
    """Collect chart-ready metrics for Ethereum L1 vs Polygon zkEVM L2."""
    eth_metrics = sample_chain_metrics("Ethereum", ethereum_rpc_url, lookback_blocks)
    zk_metrics = sample_chain_metrics("Polygon zkEVM", zkevm_rpc_url, lookback_blocks)
    eth_usd = fetch_eth_usd_price()

    # Use listItem as the baseline operation for USD tx-cost comparison.
    l1_tx_cost_usd = benchmark_data["gas_list_single"] * (eth_metrics["gas_price_gwei"] * 1e-9) * eth_usd
    l2_tx_cost_usd = benchmark_data["gas_list_single"] * (zk_metrics["gas_price_gwei"] * 1e-9) * eth_usd

    l1_values = [
        round(eth_metrics["gas_price_gwei"], 6),
        round(l1_tx_cost_usd, 6),
        round(eth_metrics["avg_block_time_s"], 3),
        round(eth_metrics["tps"], 6),
    ]
    l2_values = [
        round(zk_metrics["gas_price_gwei"], 6),
        round(l2_tx_cost_usd, 6),
        round(zk_metrics["avg_block_time_s"], 3),
        round(zk_metrics["tps"], 6),
    ]

    metadata: L1L2Metadata = {
        "ethereum_chain_id": eth_metrics["chain_id"],
        "zkevm_chain_id": zk_metrics["chain_id"],
        "eth_usd": round(eth_usd, 2),
    }

    return l1_values, l2_values, metadata


def generate_operation_comparison(
    benchmark_data: BenchmarkData,
    output_dir: Path,
    output_suffix: str,
) -> None:
    """Generate bar chart comparing gas usage across operations."""
    operations = ["listItem", "batchListItems (3)", "buyItem", "batchBuyItems (3)", "withdraw"]
    gas_used = [
        benchmark_data["gas_list_single"],
        benchmark_data["gas_batch_list_3"],
        benchmark_data["gas_buy_single"],
        benchmark_data["gas_batch_buy_3"],
        benchmark_data["gas_withdraw"],
    ]

    plt.figure(figsize=(12, 7))
    bars = plt.bar(
        operations,
        gas_used,
        color=["#3498db", "#2ecc71", "#e74c3c", "#f39c12", "#9b59b6"],
        edgecolor="black",
        linewidth=1.5,
    )

    plt.xlabel("Operation", fontsize=13, fontweight="bold")
    plt.ylabel("Gas Used", fontsize=13, fontweight="bold")
    plt.title("Gas Consumption by Operation Type", fontsize=15, fontweight="bold", pad=20)
    plt.xticks(rotation=20, ha="right", fontsize=11)
    plt.yticks(fontsize=11)

    # Add average line
    avg_gas = np.mean(gas_used)
    plt.axhline(y=avg_gas, color="red", linestyle="--", linewidth=2, label=f"Average: {avg_gas:,.0f} gas", alpha=0.7)
    plt.legend(fontsize=11, loc="upper right")

    plt.grid(axis="y", alpha=0.3, linestyle="--")

    # Add value labels on bars
    for bar in bars:
        height = bar.get_height()
        plt.text(
            bar.get_x() + bar.get_width() / 2.0,
            height,
            f"{int(height):,}",
            ha="center",
            va="bottom",
            fontsize=10,
            fontweight="bold",
        )

    plt.tight_layout()
    plt.savefig(output_dir / f"gas_usage_comparison_{output_suffix}.png", dpi=300, bbox_inches="tight")
    plt.close()


def generate_batch_size_analysis(
    benchmark_data: BenchmarkData,
    output_dir: Path,
    output_suffix: str,
) -> None:
    """Generate charts showing efficiency vs batch size."""
    batch_sizes = benchmark_data["batch_sizes"]

    gas_per_item_listing = [
        total / size if total > 0 else 0
        for total, size in zip(benchmark_data["gas_total_listing"], benchmark_data["batch_sizes"])
    ]
    gas_per_item_buying = [
        total / size if total > 0 else 0
        for total, size in zip(benchmark_data["gas_total_buying"], benchmark_data["batch_sizes"])
    ]

    baseline_listing = gas_per_item_listing[0]
    baseline_buying = gas_per_item_buying[0]

    efficiency_listing = [(baseline_listing - g) / baseline_listing * 100 for g in gas_per_item_listing]
    efficiency_buying = [(baseline_buying - g) / baseline_buying * 100 for g in gas_per_item_buying]

    _, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

    ax1.plot(
        batch_sizes,
        gas_per_item_listing,
        marker="o",
        linewidth=2.5,
        markersize=10,
        label="Listing Operations",
        color="#3498db",
    )
    ax1.plot(
        batch_sizes,
        gas_per_item_buying,
        marker="s",
        linewidth=2.5,
        markersize=10,
        label="Buying Operations",
        color="#e74c3c",
    )
    ax1.set_xlabel("Batch Size (items per transaction)", fontsize=12, fontweight="bold")
    ax1.set_ylabel("Gas Used Per Item", fontsize=12, fontweight="bold")
    ax1.set_title("Gas Efficiency vs. Batch Size", fontsize=14, fontweight="bold")
    ax1.legend(fontsize=11, loc="upper right")
    ax1.grid(True, alpha=0.3)
    ax1.set_xscale("log")

    for i, (size, listing_value, buying_value) in enumerate(
        zip(batch_sizes, gas_per_item_listing, gas_per_item_buying)
    ):
        x_offset = 8 if i % 2 == 0 else -34
        ax1.annotate(
            f"{listing_value:,.0f}",
            xy=(size, listing_value),
            xytext=(x_offset, 8),
            textcoords="offset points",
            fontsize=8,
            color="#1f77b4",
            bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.75),
        )
        ax1.annotate(
            f"{buying_value:,.0f}",
            xy=(size, buying_value),
            xytext=(x_offset, -16),
            textcoords="offset points",
            fontsize=8,
            color="#d62728",
            bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.75),
        )

    ax2.plot(
        batch_sizes,
        efficiency_listing,
        marker="o",
        linewidth=2.5,
        markersize=10,
        label="Listing Savings",
        color="#2ecc71",
    )
    ax2.plot(
        batch_sizes,
        efficiency_buying,
        marker="s",
        linewidth=2.5,
        markersize=10,
        label="Buying Savings",
        color="#f39c12",
    )
    ax2.set_xlabel("Batch Size", fontsize=12, fontweight="bold")
    ax2.set_ylabel("Gas Savings (%)", fontsize=12, fontweight="bold")
    ax2.set_title("Percentage Gas Savings vs. Individual Operations", fontsize=14, fontweight="bold")
    ax2.legend(fontsize=11, loc="lower right")
    ax2.grid(True, alpha=0.3)
    ax2.set_xscale("log")
    ax2.axhline(y=0, color="black", linestyle="--", alpha=0.3, linewidth=1)

    for i, (size, listing_saving, buying_saving) in enumerate(zip(batch_sizes, efficiency_listing, efficiency_buying)):
        x_offset = 8 if i % 2 == 0 else -30
        ax2.annotate(
            f"{listing_saving:.1f}%",
            xy=(size, listing_saving),
            xytext=(x_offset, 8),
            textcoords="offset points",
            fontsize=8,
            color="#2ca02c",
            bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.75),
        )
        ax2.annotate(
            f"{buying_saving:.1f}%",
            xy=(size, buying_saving),
            xytext=(x_offset, -16),
            textcoords="offset points",
            fontsize=8,
            color="#ff7f0e",
            bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.75),
        )

    plt.tight_layout()
    plt.savefig(output_dir / f"batch_size_efficiency_{output_suffix}.png", dpi=300, bbox_inches="tight")
    plt.close()


def generate_l1_vs_l2_comparison(
    benchmark_data: BenchmarkData,
    output_dir: Path,
    output_suffix: str,
    ethereum_rpc_url: str,
    zkevm_rpc_url: str,
    lookback_blocks: int,
) -> None:
    """Generate comparison chart between L1 and L2."""
    metrics = ["Gas Price\n(Gwei)", "Transaction\nCost ($)", "Confirmation\nTime (s)", "Throughput\n(TPS)"]
    l1_values, l2_values, _ = collect_l1_l2_metrics(
        benchmark_data,
        ethereum_rpc_url,
        zkevm_rpc_url,
        lookback_blocks,
    )

    # Log scale cannot plot zero/negative values (e.g., unknown TPS). Use a
    # tiny positive floor for rendering while keeping labels/ratios as n/a.
    positive_values = [v for v in (l1_values + l2_values) if v > 0]
    floor = (min(positive_values) / 10.0) if positive_values else 1e-9
    plot_l1 = [v if v > 0 else floor for v in l1_values]
    plot_l2 = [v if v > 0 else floor for v in l2_values]

    x = np.arange(len(metrics))
    width = 0.35

    fig, ax = plt.subplots(figsize=(14, 8))
    bars1 = ax.bar(
        x - width / 2,
        plot_l1,
        width,
        label=f"Ethereum L1 ({ethereum_rpc_url})",
        color="#e74c3c",
        edgecolor="black",
        linewidth=1.5,
    )
    bars2 = ax.bar(
        x + width / 2,
        plot_l2,
        width,
        label=f"Polygon zkEVM L2 ({zkevm_rpc_url})",
        color="#2ecc71",
        edgecolor="black",
        linewidth=1.5,
    )

    ax.set_xlabel("Metric", fontsize=13, fontweight="bold")
    ax.set_ylabel("Value", fontsize=13, fontweight="bold")
    ax.set_title("Ethereum Layer 1 vs Polygon zkEVM Layer 2 Performance", fontsize=15, fontweight="bold", pad=20)
    ax.set_xticks(x)
    ax.set_xticklabels(metrics, fontsize=11)
    ax.legend(fontsize=12, loc="upper left")
    ax.set_yscale("log")
    ax.grid(axis="y", alpha=0.3, linestyle="--")

    for bar, raw_value in zip(bars1, l1_values):
        height = bar.get_height()
        text = f"{raw_value:.4g}" if raw_value > 0 else "n/a"
        ax.text(
            bar.get_x() + bar.get_width() / 2.0,
            height * 1.08,
            text,
            ha="center",
            va="bottom",
            fontsize=9,
            fontweight="bold",
            color="#c0392b",
        )

    for bar, raw_value in zip(bars2, l2_values):
        height = bar.get_height()
        text = f"{raw_value:.4g}" if raw_value > 0 else "n/a"
        ax.text(
            bar.get_x() + bar.get_width() / 2.0,
            height * 1.08,
            text,
            ha="center",
            va="bottom",
            fontsize=9,
            fontweight="bold",
            color="#1e8449",
        )

    ratio_labels: list[str] = []
    for metric, l1, l2 in zip(metrics, l1_values, l2_values):
        if l1 <= 0 or l2 <= 0:
            # Avoid misleading infinite ratios when sampled TPS (or any metric) is zero.
            ratio_labels.append("n/a")
            continue
        ratio = l1 / l2
        if metric == "Throughput\n(TPS)":
            ratio_labels.append(f"{ratio:.2f}x")
        else:
            ratio_labels.append(f"{ratio:.0f}x")

    for i, (bar1, bar2, ratio_label) in enumerate(zip(bars1, bars2, ratio_labels)):
        height = max(bar1.get_height(), bar2.get_height())
        ax.text(
            i,
            height * 1.45,
            ratio_label,
            ha="center",
            va="bottom",
            fontsize=10,
            fontweight="bold",
            color="#9b59b6",
        )

    fig.tight_layout()
    fig.savefig(output_dir / f"l1_vs_l2_comparison_{output_suffix}.png", dpi=300)
    plt.close()


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments for configurable chart generation."""
    parser = argparse.ArgumentParser(
        description="Generate benchmark visualizations from Hardhat benchmark_results.json.",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=BENCHMARK_RESULTS_FILE,
        help="Path to benchmark JSON file (default: ./benchmark_results.json).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path.cwd(),
        help="Directory for generated PNG files (default: current directory).",
    )
    parser.add_argument(
        "--include-l1-l2",
        action="store_true",
        help="Generate l1_vs_l2_comparison.png using live public RPC metrics.",
    )
    parser.add_argument(
        "--ethereum-rpc-url",
        default=ETHEREUM_RPC_URL,
        help="Ethereum RPC URL for L1/L2 comparison chart.",
    )
    parser.add_argument(
        "--zkevm-rpc-url",
        default=ZKEVM_RPC_URL,
        help="Polygon zkEVM RPC URL for L1/L2 comparison chart.",
    )
    parser.add_argument(
        "--lookback-blocks",
        type=int,
        default=METRIC_LOOKBACK_BLOCKS,
        help="Lookback blocks for chain metric sampling (L1/L2 chart only).",
    )
    return parser.parse_args()


def main() -> None:
    """Generate all visualizations."""
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    all_data = load_all_benchmark_data_from_file(args.input)
    if not all_data:
        raise RuntimeError(
            f"Required benchmark data is missing or invalid: {args.input}. "
            "Run scripts/benchmark.js first and verify it contains runs.<network>.byBatchSize entries."
        )

    for network_key, benchmark_data in all_data.items():
        output_suffix = _sanitize_identifier(network_key)

        generate_operation_comparison(benchmark_data, args.output_dir, output_suffix)
        generate_batch_size_analysis(benchmark_data, args.output_dir, output_suffix)

        if args.include_l1_l2 and not _is_local_network_key(network_key):
            generate_l1_vs_l2_comparison(
                benchmark_data,
                args.output_dir,
                output_suffix,
                args.ethereum_rpc_url,
                args.zkevm_rpc_url,
                args.lookback_blocks,
            )

if __name__ == "__main__":
    main()
