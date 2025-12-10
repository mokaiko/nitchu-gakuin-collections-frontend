import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBrowserProvider } from '../lib/contracts';
export function useWallet() {
    const [account, setAccount] = useState();
    const [chainId, setChainId] = useState();
    const [error, setError] = useState();
    const [isConnecting, setIsConnecting] = useState(false);
    const provider = useMemo(() => getBrowserProvider(), []);
    useEffect(() => {
        const eth = window.ethereum;
        if (!eth)
            return;
        const handleAccountsChanged = (accounts) => {
            if (Array.isArray(accounts) && typeof accounts[0] === 'string') {
                setAccount(accounts[0]);
            }
            else {
                setAccount(undefined);
            }
        };
        const handleChainChanged = (hexId) => {
            if (typeof hexId === 'string') {
                setChainId(parseInt(hexId, 16));
            }
        };
        eth.request?.({ method: 'eth_accounts' }).then((accounts) => {
            if (Array.isArray(accounts) && accounts[0]) {
                setAccount(accounts[0]);
            }
        });
        eth.request?.({ method: 'eth_chainId' }).then((id) => {
            if (typeof id === 'string') {
                setChainId(parseInt(id, 16));
            }
        });
        eth.on?.('accountsChanged', handleAccountsChanged);
        eth.on?.('chainChanged', handleChainChanged);
        return () => {
            eth.removeListener?.('accountsChanged', handleAccountsChanged);
            eth.removeListener?.('chainChanged', handleChainChanged);
        };
    }, []);
    const connect = useCallback(async () => {
        if (!provider) {
            setError('MetaMask が見つかりません。ブラウザ拡張を確認してください。');
            return;
        }
        try {
            setIsConnecting(true);
            setError(undefined);
            const accounts = (await provider.send('eth_requestAccounts', []));
            const chainHex = (await provider.send('eth_chainId', []));
            setAccount(accounts?.[0]);
            setChainId(chainHex ? parseInt(chainHex, 16) : undefined);
        }
        catch (err) {
            console.error(err);
            setError('ウォレット接続に失敗しました。再度お試しください。');
        }
        finally {
            setIsConnecting(false);
        }
    }, [provider]);
    const disconnect = useCallback(() => {
        setAccount(undefined);
        setError(undefined);
    }, []);
    return {
        account,
        chainId,
        provider,
        isConnecting,
        error,
        connect,
        disconnect,
        isMetaMaskAvailable: Boolean(window.ethereum?.isMetaMask)
    };
}
