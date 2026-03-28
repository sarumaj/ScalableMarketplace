import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider } from "ethers";
import { CHAIN_CONFIG, PREFERRED_CHAIN_ID } from "../config";
import { humanizeError } from "../utils";

export function useWeb3() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRequestingAccountAccess, setIsRequestingAccountAccess] =
    useState(false);
  const [error, setError] = useState("");
  const selectedAccountRef = useRef("");
  const walletRequestInFlightRef = useRef(false);

  const hasMetaMask = typeof window !== "undefined" && Boolean(window.ethereum);

  const resolvePreferredAccount = useCallback((accounts, preferredAccount) => {
    if (!accounts.length) {
      return "";
    }

    const preferred = (preferredAccount || "").toLowerCase();
    if (preferred) {
      const matchedPreferred = accounts.find(
        (candidate) => candidate.toLowerCase() === preferred,
      );
      if (matchedPreferred) {
        return matchedPreferred;
      }
    }

    return accounts[0];
  }, []);

  const applySelectedAccount = useCallback((nextAccount) => {
    selectedAccountRef.current = nextAccount || "";
    setAccount(nextAccount || "");
  }, []);

  const refreshWalletState = useCallback(
    async (preferredAccount = "") => {
      if (!window.ethereum) {
        return;
      }

      const nextProvider = new BrowserProvider(window.ethereum);
      const network = await nextProvider.getNetwork();
      const accounts = await nextProvider.send("eth_accounts", []);

      setProvider(nextProvider);
      setChainId(Number(network.chainId));
      setAvailableAccounts(accounts);

      if (accounts.length > 0) {
        const selectedAccount = resolvePreferredAccount(
          accounts,
          preferredAccount || selectedAccountRef.current || account,
        );
        const nextSigner = await nextProvider.getSigner(selectedAccount);
        setSigner(nextSigner);
        applySelectedAccount(selectedAccount);
      } else {
        setSigner(null);
        applySelectedAccount("");
      }
    },
    [account, applySelectedAccount, resolvePreferredAccount],
  );

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed.");
      return;
    }

    if (walletRequestInFlightRef.current) {
      setError(
        "A MetaMask request is already pending. Open MetaMask and complete or reject it first.",
      );
      return;
    }

    setIsConnecting(true);
    setError("");
    walletRequestInFlightRef.current = true;

    try {
      const requestedAccounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      await refreshWalletState();

      if (requestedAccounts.length > 0) {
        const nextProvider = new BrowserProvider(window.ethereum);
        const selectedAccount = resolvePreferredAccount(requestedAccounts);
        const nextSigner = await nextProvider.getSigner(selectedAccount);
        setProvider(nextProvider);
        setSigner(nextSigner);
        applySelectedAccount(selectedAccount);
        setAvailableAccounts(requestedAccounts);
      }
    } catch (connectError) {
      if (connectError?.code === -32002) {
        setError(
          "MetaMask already has a pending connection request. Open MetaMask and finish it, then try again.",
        );
      } else {
        setError(humanizeError(connectError));
      }
    } finally {
      walletRequestInFlightRef.current = false;
      setIsConnecting(false);
    }
  }, [applySelectedAccount, refreshWalletState, resolvePreferredAccount]);

  const requestAccountAccess = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed.");
      return;
    }

    if (walletRequestInFlightRef.current || isRequestingAccountAccess) {
      setError(
        "A MetaMask request is already pending. Open MetaMask and complete or reject it first.",
      );
      return;
    }

    setError("");
    setIsRequestingAccountAccess(true);
    walletRequestInFlightRef.current = true;

    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });

      await refreshWalletState();
    } catch (permissionError) {
      if (permissionError?.code === -32002) {
        setError(
          "MetaMask already has a pending permissions request. Open MetaMask and finish it, then try again.",
        );
      } else {
        setError(humanizeError(permissionError));
      }
    } finally {
      walletRequestInFlightRef.current = false;
      setIsRequestingAccountAccess(false);
    }
  }, [isRequestingAccountAccess, refreshWalletState]);

  const selectAccount = useCallback(
    async (nextAccount) => {
      if (!window.ethereum) {
        setError("MetaMask is not installed.");
        return;
      }

      if (!nextAccount) {
        return;
      }

      const nextProvider = new BrowserProvider(window.ethereum);
      const accounts = await nextProvider.send("eth_accounts", []);

      if (!accounts.includes(nextAccount)) {
        setError(
          "Selected account is not currently exposed to this app in MetaMask.",
        );
        return;
      }

      setError("");
      const nextSigner = await nextProvider.getSigner(nextAccount);
      setProvider(nextProvider);
      setSigner(nextSigner);
      applySelectedAccount(nextAccount);
      setAvailableAccounts(accounts);
    },
    [applySelectedAccount],
  );

  const switchNetwork = useCallback(
    async (targetChainId = PREFERRED_CHAIN_ID) => {
      if (!window.ethereum) {
        setError("MetaMask is not installed.");
        return;
      }

      const network = CHAIN_CONFIG[targetChainId];
      if (!network) {
        setError(`Unsupported chain id: ${targetChainId}`);
        return;
      }

      setError("");

      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: network.chainIdHex }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: network.chainIdHex,
                chainName: network.chainName,
                nativeCurrency: network.nativeCurrency,
                rpcUrls: network.rpcUrls,
                blockExplorerUrls: network.blockExplorerUrls,
              },
            ],
          });
        } else {
          setError(humanizeError(switchError));
          return;
        }
      }

      await refreshWalletState();
    },
    [refreshWalletState],
  );

  useEffect(() => {
    if (!window.ethereum) {
      return undefined;
    }

    refreshWalletState().catch(() => {
      setError("Failed to initialize web3 provider.");
    });

    const handleAccountsChanged = (accounts) => {
      setAvailableAccounts(accounts);
      if (!accounts.length) {
        applySelectedAccount("");
        setSigner(null);
      } else {
        const preferredAccount = resolvePreferredAccount(
          accounts,
          selectedAccountRef.current,
        );
        refreshWalletState(preferredAccount).catch(() => {
          setError("Failed to refresh signer state.");
        });
      }
    };

    const handleChainChanged = () => {
      refreshWalletState().catch(() => {
        setError("Failed to refresh network state.");
      });
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [applySelectedAccount, refreshWalletState, resolvePreferredAccount]);

  const currentChainConfig = useMemo(() => {
    if (chainId == null) {
      return null;
    }
    return CHAIN_CONFIG[chainId] || null;
  }, [chainId]);

  return {
    hasMetaMask,
    provider,
    signer,
    account,
    availableAccounts,
    chainId,
    chainName: currentChainConfig?.chainName || "Unknown network",
    currentChainConfig,
    isConnecting,
    isRequestingAccountAccess,
    error,
    connectWallet,
    requestAccountAccess,
    selectAccount,
    switchNetwork,
  };
}
