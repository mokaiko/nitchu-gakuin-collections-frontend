import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toUtf8Bytes } from "ethers";
const MAX_CHUNK_CHARS = 28000; // 約30KB相当（UTF-8文字数ベース）
import { CollectionCard } from "./components/CollectionCard";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { DEFAULT_CHAIN_ID, getNetworkConfig, } from "./config/networks";
import { useWallet } from "./hooks/useWallet";
import { getContract, getRpcProvider, listCollectionIds, loadCollections, } from "./lib/contracts";
import "./styles/layout.css";
export default function App() {
    const [tab, setTab] = useState("gallery");
    const readChainId = DEFAULT_CHAIN_ID;
    const [collections, setCollections] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState();
    const [claimingId, setClaimingId] = useState();
    const [lastUpdated, setLastUpdated] = useState(null);
    const [ownerAddress, setOwnerAddress] = useState();
    const [isOwner, setIsOwner] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [contractVersion, setContractVersion] = useState();
    const [isPaused, setIsPaused] = useState();
    const [adminSection, setAdminSection] = useState("info");
    const [txMessage, setTxMessage] = useState();
    const canAdmin = useMemo(() => isOwner || isAdmin, [isOwner, isAdmin]);
    const [adminCheckResult, setAdminCheckResult] = useState(undefined);
    const { account, chainId, provider, connect, disconnect, isConnecting, error: walletError, isMetaMaskAvailable, } = useWallet();
    const network = useMemo(() => getNetworkConfig(readChainId), [readChainId]);
    const readProvider = useMemo(() => getRpcProvider(network.chainId), [network.chainId]);
    const readContract = useMemo(() => getContract(network.chainId, readProvider), [network.chainId, readProvider]);
    const refreshCollections = useCallback(async () => {
        if (!readContract)
            return;
        setIsLoading(true);
        setError(undefined);
        try {
            const ids = await listCollectionIds(readContract);
            const data = ids.length
                ? await loadCollections(readContract, ids, account)
                : [];
            setCollections(data);
            setLastUpdated(new Date());
        }
        catch (err) {
            console.error(err);
            setError("コレクション情報の取得に失敗しました。RPCやネットワーク設定を確認してください。");
        }
        finally {
            setIsLoading(false);
        }
    }, [account, readContract]);
    const checkAdmin = useCallback(async () => {
        if (!account) {
            setIsAdmin(false);
            setIsOwner(false);
            return;
        }
        try {
            const owner = await readContract.owner();
            setOwnerAddress(owner);
            setIsOwner(owner.toLowerCase() === account.toLowerCase());
            const adminFlag = await readContract.isAdmin(account);
            setIsAdmin(Boolean(adminFlag));
            const version = await readContract.getVersion();
            setContractVersion(version);
            const pausedFlag = await readContract.paused();
            setIsPaused(Boolean(pausedFlag));
        }
        catch (err) {
            console.error(err);
        }
    }, [account, readContract]);
    useEffect(() => {
        void refreshCollections();
    }, [refreshCollections]);
    useEffect(() => {
        void checkAdmin();
    }, [checkAdmin]);
    useEffect(() => {
        if (tab === "admin" && !canAdmin) {
            setTab("gallery");
        }
    }, [tab, canAdmin]);
    const handleClaim = useCallback(async (tokenId) => {
        if (!provider) {
            setError("MetaMask が検知できません。ブラウザ拡張を有効にしてください。");
            return;
        }
        const targetNetwork = getNetworkConfig(readChainId);
        if (chainId !== targetNetwork.chainId) {
            setError(`${targetNetwork.name} にネットワークを切り替えてから実行してください。`);
            return;
        }
        try {
            setClaimingId(tokenId);
            setError(undefined);
            const signer = await provider.getSigner();
            const writeContract = getContract(targetNetwork.chainId, signer);
            const tx = await writeContract.claim(tokenId);
            await tx.wait();
            await refreshCollections();
        }
        catch (err) {
            console.error(err);
            const message = err?.info?.error?.message ||
                err?.reason ||
                err?.shortMessage ||
                "トランザクションが失敗しました。残数・ホワイトリスト・ネットワークを確認してください。";
            setError(message);
        }
        finally {
            setClaimingId(undefined);
        }
    }, [chainId, provider, readChainId, refreshCollections]);
    const claimableCollections = useMemo(() => {
        // 受付中かつ SVG 確定済みのものを全て表示。受領可否はカード側で理由付き表示。
        return collections.filter((item) => item.isActive && item.isSvgFinalized);
    }, [collections]);
    const finalizedCollections = useMemo(() => collections.filter((item) => item.isSvgFinalized), [collections]);
    const ensureAuthorized = () => {
        if (!account)
            return "MetaMask を接続してください。";
        if (!isOwner && !isAdmin)
            return "この機能はオーナーまたは管理者のみ利用できます。";
        if (chainId !== network.chainId)
            return `${network.name} に切り替えてください。`;
        return null;
    };
    const withTx = async (fn) => {
        const blocker = ensureAuthorized();
        if (blocker) {
            setError(blocker);
            return;
        }
        if (!provider) {
            setError("MetaMask が見つかりません。");
            return;
        }
        try {
            setTxMessage("送信中…");
            const signer = await provider.getSigner();
            const writeContract = getContract(network.chainId, signer);
            await fn(writeContract);
            setTxMessage("完了しました。");
            await refreshCollections();
            await checkAdmin();
        }
        catch (err) {
            console.error(err);
            const message = err?.info?.error?.message ||
                err?.reason ||
                err?.shortMessage ||
                "トランザクションに失敗しました。";
            setError(message);
        }
        finally {
            setTxMessage(undefined);
        }
    };
    const [formCreate, setFormCreate] = useState({
        name: "",
        description: "",
        maxSupply: "",
        whitelist: false,
        active: true,
    });
    const [formStatus, setFormStatus] = useState({
        tokenId: "",
        whitelist: false,
        active: true,
    });
    const [statusCheck, setStatusCheck] = useState({
        tokenId: "",
    });
    const [formWhitelist, setFormWhitelist] = useState({
        tokenId: "",
        addresses: "",
        mode: "add",
    });
    const [whitelistCheck, setWhitelistCheck] = useState({
        tokenId: "",
        address: "",
    });
    const [formSvg, setFormSvg] = useState({
        tokenId: "",
        chunkIndex: "",
        chunkData: "",
    });
    const [formAirdrop, setFormAirdrop] = useState({
        tokenId: "",
        recipients: "",
    });
    const [formAdmins, setFormAdmins] = useState({
        address: "",
        mode: "add",
    });
    const [formTransferOwner, setFormTransferOwner] = useState("");
    const [isMobile, setIsMobile] = useState(false);
    const [copiedKey, setCopiedKey] = useState("");
    const copyTimerRef = useRef(null);
    useEffect(() => {
        const handleResize = () => {
            if (typeof window !== "undefined") {
                setIsMobile(window.innerWidth < 768);
            }
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);
    const formatAddress = (addr) => {
        if (!addr)
            return "";
        if (isMobile && addr.length > 10) {
            return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
        }
        return addr;
    };
    const renderAddress = (addr, fallback = "取得中", key = "") => {
        if (!addr) {
            return _jsx("span", { className: "addr-wrap", children: fallback });
        }
        const display = formatAddress(addr);
        const uniqueKey = key || addr;
        return (_jsxs("span", { className: "addr-wrap", children: [_jsx("span", { className: "addr-text", children: display }), _jsx("button", { type: "button", className: "icon-btn copy-btn", "aria-label": "\u30A2\u30C9\u30EC\u30B9\u3092\u30B3\u30D4\u30FC", onClick: async () => {
                        try {
                            await navigator.clipboard.writeText(addr);
                        }
                        catch (err) {
                            try {
                                const textarea = document.createElement("textarea");
                                textarea.value = addr;
                                document.body.appendChild(textarea);
                                textarea.select();
                                document.execCommand("copy");
                                document.body.removeChild(textarea);
                            }
                            catch (fallbackErr) {
                                console.error(fallbackErr);
                                setError("コピーに失敗しました。");
                                return;
                            }
                        }
                        setCopiedKey(uniqueKey);
                        if (copyTimerRef.current) {
                            clearTimeout(copyTimerRef.current);
                        }
                        copyTimerRef.current = setTimeout(() => {
                            setCopiedKey("");
                        }, 5000);
                    }, children: _jsx("span", { className: "icon icon-copy", "aria-hidden": "true" }) }), copiedKey === uniqueKey ? (_jsx("span", { className: "copy-success", children: "\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F" })) : null] }));
    };
    return (_jsxs("div", { className: "page-shell", children: [_jsx(SiteHeader, { onConnect: connect, onDisconnect: disconnect, account: account, isConnecting: isConnecting }), _jsx("main", { className: "content", children: _jsxs("div", { className: "container", children: [_jsxs("div", { className: "page-hero", children: [_jsxs("div", { style: {
                                        display: "flex",
                                        gap: 10,
                                        flexWrap: "wrap",
                                        marginBottom: 8,
                                    }, children: [_jsx("div", { className: "badge", children: "\u65E5\u4E2D\u5B66\u9662\u30C7\u30B8\u30BF\u30EB\u30B3\u30EC\u30AF\u30B7\u30E7\u30F3" }), _jsx("div", { className: "badge accent", children: "Optimism ERC-1155" })] }), _jsx("h1", { className: "title", children: "\u30B3\u30EC\u30AF\u30B7\u30E7\u30F3\u4E00\u89A7\u3068\u53D7\u3051\u53D6\u308A" }), _jsx("p", { className: "subtitle", children: "Optimism \u4E0A\u306E\u65E5\u4E2D\u5B66\u9662 ERC-1155 \u30B3\u30EC\u30AF\u30B7\u30E7\u30F3\u3092\u95B2\u89A7\u30FB\u53D7\u3051\u53D6\u308A\u3067\u304D\u307E\u3059\u3002MetaMask \u3092\u63A5\u7D9A\u3057\u3001\u53D7\u9818\u53EF\u80FD\u306A NFT \u3092\u8ACB\u6C42\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }), _jsxs("div", { className: "cta-row", children: [_jsxs("div", { className: "network-chip", children: ["\u30B3\u30F3\u30C8\u30E9\u30AF\u30C8: ", renderAddress(network.contractAddress, "取得中", "hero-contract")] }), network.explorer ? (_jsx("a", { className: "network-chip", href: `${network.explorer}/address/${network.contractAddress}`, target: "_blank", rel: "noreferrer", children: "\u30D6\u30ED\u30C3\u30AF\u30A8\u30AF\u30B9\u30D7\u30ED\u30FC\u30E9\u30FC" })) : null] })] }), _jsxs("div", { className: "tab-bar", children: [_jsx("button", { className: `tab-btn ${tab === "gallery" ? "active" : ""}`, onClick: () => setTab("gallery"), children: "\u30B3\u30EC\u30AF\u30B7\u30E7\u30F3\u4E00\u89A7" }), _jsx("button", { className: `tab-btn ${tab === "claim" ? "active" : ""}`, onClick: () => setTab("claim"), children: "\u53D7\u3051\u53D6\u308A" }), canAdmin ? (_jsx("button", { className: `tab-btn ${tab === "admin" ? "active" : ""}`, onClick: () => setTab("admin"), children: "\u7BA1\u7406" })) : null] }), _jsxs("div", { className: "panel", children: [_jsxs("div", { className: "cta-row", style: { marginBottom: 8 }, children: [_jsx("div", { className: "section-title", children: tab === "gallery"
                                                ? "コレクション一覧 (ID 昇順)"
                                                : tab === "claim"
                                                    ? "受領可能なコレクション"
                                                    : "管理メニュー" }), _jsxs("div", { style: { display: "flex", gap: 10, alignItems: "center" }, children: [lastUpdated ? (_jsxs("span", { className: "hint", children: ["\u6700\u7D42\u66F4\u65B0: ", lastUpdated.toLocaleTimeString()] })) : null, _jsx("button", { className: "btn btn-secondary", onClick: () => refreshCollections(), disabled: isLoading, children: isLoading ? "更新中…" : "最新の状態を取得" })] })] }), error ? _jsx("div", { className: "notice", children: error }) : null, tab === "gallery" ? (_jsx("div", { className: "collections-grid", children: isLoading ? (_jsx("div", { className: "notice", children: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026" })) : finalizedCollections.length === 0 ? (_jsx("div", { className: "notice", children: "\u8868\u793A\u3067\u304D\u308B\u30B3\u30EC\u30AF\u30B7\u30E7\u30F3\u304C\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002" })) : (_jsx("div", { className: "grid gallery", children: finalizedCollections.map((item) => (_jsx(CollectionCard, { collection: item, showClaimAction: false, connected: Boolean(account) }, item.tokenId))) })) })) : null, tab === "claim" ? (_jsxs("div", { className: "collections-grid", children: [walletError ? (_jsx("div", { className: "notice", children: walletError })) : null, !isMetaMaskAvailable ? (_jsx("div", { className: "notice", children: "MetaMask \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\u62E1\u5F35\u6A5F\u80FD\u3092\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })) : null, !account ? (_jsx("div", { className: "notice", children: "MetaMask \u3092\u63A5\u7D9A\u3059\u308B\u3068\u53D7\u3051\u53D6\u308A\u53EF\u5426\u3092\u5224\u5B9A\u3057\u307E\u3059\u3002" })) : null, isLoading ? (_jsx("div", { className: "notice", children: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026" })) : claimableCollections.length === 0 ? (_jsx("div", { className: "notice", children: "\u73FE\u5728\u53D7\u9818\u3067\u304D\u308B NFT \u306F\u3042\u308A\u307E\u305B\u3093\u3002" })) : (_jsx("div", { className: "grid gallery", children: claimableCollections.map((item) => (_jsx(CollectionCard, { collection: item, showClaimAction: true, onClaim: handleClaim, isClaiming: claimingId === item.tokenId, connected: Boolean(account) }, item.tokenId))) }))] })) : null, tab === "admin" ? (_jsxs("div", { className: "admin-layout", children: [_jsxs("div", { className: "admin-menu", children: [_jsxs("button", { className: adminSection === "info" ? "menu-btn active" : "menu-btn", onClick: () => setAdminSection("info"), children: [_jsx("span", { className: "icon icon-info", "aria-hidden": "true" }), " ", "\u30B3\u30F3\u30C8\u30E9\u30AF\u30C8\u60C5\u5831"] }), _jsxs("button", { className: adminSection === "create" ? "menu-btn active" : "menu-btn", onClick: () => setAdminSection("create"), children: [_jsx("span", { className: "icon icon-new", "aria-hidden": "true" }), " ", "\u65B0\u898F\u4F5C\u6210"] }), _jsxs("button", { className: adminSection === "svg" ? "menu-btn active" : "menu-btn", onClick: () => setAdminSection("svg"), children: [_jsx("span", { className: "icon icon-image", "aria-hidden": "true" }), " ", "SVG\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9"] }), _jsxs("button", { className: adminSection === "status" ? "menu-btn active" : "menu-btn", onClick: () => setAdminSection("status"), children: [_jsx("span", { className: "icon icon-toggle", "aria-hidden": "true" }), " ", "\u72B6\u614B\u66F4\u65B0"] }), _jsxs("button", { className: adminSection === "whitelist"
                                                        ? "menu-btn active"
                                                        : "menu-btn", onClick: () => setAdminSection("whitelist"), children: [_jsx("span", { className: "icon icon-list", "aria-hidden": "true" }), " ", "\u30DB\u30EF\u30A4\u30C8\u30EA\u30B9\u30C8"] }), _jsxs("button", { className: adminSection === "airdrop"
                                                        ? "menu-btn active"
                                                        : "menu-btn", onClick: () => setAdminSection("airdrop"), children: [_jsx("span", { className: "icon icon-gift", "aria-hidden": "true" }), " ", "\u30A8\u30A2\u30C9\u30ED\u30C3\u30D7"] }), _jsxs("button", { className: adminSection === "admins" ? "menu-btn active" : "menu-btn", onClick: () => setAdminSection("admins"), children: [_jsx("span", { className: "icon icon-admin", "aria-hidden": "true" }), " ", "\u7BA1\u7406\u8005\u7BA1\u7406"] }), _jsxs("button", { className: adminSection === "contract"
                                                        ? "menu-btn active"
                                                        : "menu-btn", onClick: () => setAdminSection("contract"), children: [_jsx("span", { className: "icon icon-settings", "aria-hidden": "true" }), " ", "\u30B3\u30F3\u30C8\u30E9\u30AF\u30C8\u7BA1\u7406"] })] }), _jsxs("div", { className: "admin-body", children: [_jsxs("div", { className: "notice", children: [_jsxs("div", { children: ["\u73FE\u5728\u306E\u63A5\u7D9A: ", account ? renderAddress(account, "未接続", "admin-current") : "未接続"] }), _jsxs("div", { children: ["\u63A5\u7D9A\u306E\u6A29\u9650:", " ", isOwner ? "オーナー" : isAdmin ? "管理者" : "なし"] })] }), txMessage ? _jsx("div", { className: "notice", children: txMessage }) : null, adminSection === "info" ? (_jsxs("div", { className: "admin-section", children: [_jsx("h3", { children: "\u30B3\u30F3\u30C8\u30E9\u30AF\u30C8\u60C5\u5831" }), _jsxs("p", { children: ["\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF: ", network.name] }), _jsxs("p", { children: ["\u30A2\u30C9\u30EC\u30B9: ", renderAddress(network.contractAddress, "取得中", "info-contract")] }), _jsxs("p", { children: ["\u30AA\u30FC\u30CA\u30FC: ", renderAddress(ownerAddress, "取得中", "info-owner")] }), _jsxs("p", { children: ["\u30D0\u30FC\u30B8\u30E7\u30F3: ", contractVersion ?? "取得中"] })] })) : null, adminSection === "create" ? (_jsxs("div", { className: "admin-section", children: [_jsx("h3", { children: "\u65B0\u898F\u30B3\u30EC\u30AF\u30B7\u30E7\u30F3\u4F5C\u6210" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["\u540D\u524D", _jsx("input", { value: formCreate.name, onChange: (e) => setFormCreate({
                                                                                ...formCreate,
                                                                                name: e.target.value,
                                                                            }) })] }), _jsxs("label", { children: ["\u8AAC\u660E", _jsx("textarea", { value: formCreate.description, onChange: (e) => setFormCreate({
                                                                                ...formCreate,
                                                                                description: e.target.value,
                                                                            }), rows: 2 })] }), _jsxs("label", { children: ["\u6700\u5927\u4F9B\u7D66 (0 \u3067\u7121\u5236\u9650)", _jsx("input", { type: "number", value: formCreate.maxSupply, onChange: (e) => setFormCreate({
                                                                                ...formCreate,
                                                                                maxSupply: e.target.value,
                                                                            }) })] }), _jsxs("label", { className: "toggle-row", children: [_jsx("span", { children: "\u30DB\u30EF\u30A4\u30C8\u30EA\u30B9\u30C8\u6709\u52B9\uFF08\u6307\u5B9A\u30E6\u30FC\u30B6\u30FC\u306E\u307F\u53D7\u9818\u53EF\uFF09" }), _jsx("input", { className: "toggle-switch", type: "checkbox", checked: formCreate.whitelist, onChange: (e) => setFormCreate({
                                                                                ...formCreate,
                                                                                whitelist: e.target.checked,
                                                                            }) })] }), _jsxs("label", { className: "toggle-row", children: [_jsx("span", { children: "\u30A2\u30AF\u30C6\u30A3\u30D6\uFF08\u4F5C\u6210\u76F4\u5F8C\u304B\u3089\u53D7\u9818\u53EF\u80FD\uFF09" }), _jsx("input", { className: "toggle-switch", type: "checkbox", checked: formCreate.active, onChange: (e) => setFormCreate({
                                                                                ...formCreate,
                                                                                active: e.target.checked,
                                                                            }) })] }), _jsx("button", { className: "btn", disabled: !formCreate.name || !formCreate.description, onClick: () => withTx(async (c) => {
                                                                        await c.createCollection(formCreate.name, formCreate.description, BigInt(formCreate.maxSupply || 0), formCreate.whitelist, formCreate.active);
                                                                        setFormCreate({
                                                                            name: "",
                                                                            description: "",
                                                                            maxSupply: "",
                                                                            whitelist: false,
                                                                            active: true,
                                                                        });
                                                                    }), children: "\u4F5C\u6210" })] })] })) : null, adminSection === "status" ? (_jsxs("div", { className: "admin-section", children: [_jsx("h3", { children: "\u72B6\u614B\u66F4\u65B0" }), _jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "notice", style: {
                                                                        display: "flex",
                                                                        flexDirection: "column",
                                                                        gap: 8,
                                                                    }, children: [_jsx("strong", { children: "\u73FE\u5728\u306E\u72B6\u614B\u78BA\u8A8D" }), _jsxs("div", { style: {
                                                                                display: "flex",
                                                                                gap: 8,
                                                                                flexWrap: "wrap",
                                                                            }, children: [_jsx("input", { className: "input-inline", style: { flex: "1 1 160px" }, placeholder: "Token ID", value: statusCheck.tokenId, onChange: (e) => setStatusCheck({
                                                                                        ...statusCheck,
                                                                                        tokenId: e.target.value,
                                                                                        result: undefined,
                                                                                    }) }), _jsx("button", { className: "btn btn-secondary", disabled: !statusCheck.tokenId, onClick: async () => {
                                                                                        try {
                                                                                            const info = await readContract.getCollectionInfo(Number(statusCheck.tokenId));
                                                                                            setStatusCheck({
                                                                                                ...statusCheck,
                                                                                                result: {
                                                                                                    whitelist: Boolean(info.isWhitelistEnabled ?? info[4]),
                                                                                                    active: Boolean(info.isActive ?? info[5]),
                                                                                                    svgFinalized: Boolean(info.isSvgFinalized ?? info[7]),
                                                                                                    maxSupply: Number(info.maxSupply ?? info[2] ?? 0n),
                                                                                                    currentSupply: Number(info.currentSupply ?? info[3] ?? 0n),
                                                                                                },
                                                                                            });
                                                                                        }
                                                                                        catch (err) {
                                                                                            console.error(err);
                                                                                            setStatusCheck({
                                                                                                ...statusCheck,
                                                                                                result: undefined,
                                                                                            });
                                                                                            setError("状態の取得に失敗しました。");
                                                                                        }
                                                                                    }, children: "\u78BA\u8A8D" })] }), statusCheck.result ? (_jsxs("div", { style: {
                                                                                display: "flex",
                                                                                flexDirection: "column",
                                                                                gap: 4,
                                                                            }, children: [_jsxs("span", { children: ["\u30A2\u30AF\u30C6\u30A3\u30D6:", " ", statusCheck.result.active ? "はい" : "いいえ"] }), _jsxs("span", { children: ["\u30DB\u30EF\u30A4\u30C8\u30EA\u30B9\u30C8\u6709\u52B9:", " ", statusCheck.result.whitelist
                                                                                            ? "はい"
                                                                                            : "いいえ"] }), _jsxs("span", { children: ["SVG \u78BA\u5B9A:", " ", statusCheck.result.svgFinalized
                                                                                            ? "はい"
                                                                                            : "いいえ"] }), _jsxs("span", { children: ["\u4F9B\u7D66: ", statusCheck.result.currentSupply, " /", " ", statusCheck.result.maxSupply === 0
                                                                                            ? "∞"
                                                                                            : statusCheck.result.maxSupply] })] })) : null] }), _jsxs("label", { children: ["Token ID", _jsx("input", { className: "input-inline", value: formStatus.tokenId, onChange: (e) => setFormStatus({
                                                                                ...formStatus,
                                                                                tokenId: e.target.value,
                                                                            }) })] }), _jsxs("label", { className: "toggle-row", children: [_jsx("span", { children: "\u30DB\u30EF\u30A4\u30C8\u30EA\u30B9\u30C8\u6709\u52B9\uFF08\u6307\u5B9A\u30E6\u30FC\u30B6\u30FC\u306E\u307F\u53D7\u9818\u53EF\uFF09" }), _jsx("input", { className: "toggle-switch", type: "checkbox", checked: formStatus.whitelist, onChange: (e) => setFormStatus({
                                                                                ...formStatus,
                                                                                whitelist: e.target.checked,
                                                                            }) })] }), _jsxs("label", { className: "toggle-row", children: [_jsx("span", { children: "\u30A2\u30AF\u30C6\u30A3\u30D6\uFF08\u4F5C\u6210\u76F4\u5F8C\u304B\u3089\u53D7\u9818\u53EF\u80FD\uFF09" }), _jsx("input", { className: "toggle-switch", type: "checkbox", checked: formStatus.active, onChange: (e) => setFormStatus({
                                                                                ...formStatus,
                                                                                active: e.target.checked,
                                                                            }) })] }), _jsx("button", { className: "btn", disabled: !formStatus.tokenId, onClick: () => withTx(async (c) => {
                                                                        await c.updateCollectionStatus(Number(formStatus.tokenId), formStatus.whitelist, formStatus.active);
                                                                    }), children: "\u66F4\u65B0" })] })] })) : null, adminSection === "whitelist" ? (_jsxs("div", { className: "admin-section", children: [_jsx("h3", { children: "\u30DB\u30EF\u30A4\u30C8\u30EA\u30B9\u30C8\u7BA1\u7406" }), _jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "notice", style: {
                                                                        display: "flex",
                                                                        flexDirection: "column",
                                                                        gap: 8,
                                                                    }, children: [_jsx("strong", { children: "\u30A2\u30C9\u30EC\u30B9\u78BA\u8A8D" }), _jsxs("div", { style: {
                                                                                display: "flex",
                                                                                gap: 8,
                                                                                flexWrap: "wrap",
                                                                            }, children: [_jsx("input", { className: "input-inline", style: { flex: "1 1 160px" }, placeholder: "Token ID", value: whitelistCheck.tokenId, onChange: (e) => setWhitelistCheck({
                                                                                        ...whitelistCheck,
                                                                                        tokenId: e.target.value,
                                                                                    }) }), _jsx("input", { className: "input-inline", style: { flex: "2 1 220px" }, placeholder: "\u30A2\u30C9\u30EC\u30B9", value: whitelistCheck.address, onChange: (e) => setWhitelistCheck({
                                                                                        ...whitelistCheck,
                                                                                        address: e.target.value,
                                                                                    }) }), _jsx("button", { className: "btn btn-secondary", disabled: !whitelistCheck.tokenId ||
                                                                                        !whitelistCheck.address, onClick: async () => {
                                                                                        try {
                                                                                            const flag = await readContract.isWhitelisted(Number(whitelistCheck.tokenId), whitelistCheck.address);
                                                                                            setWhitelistCheck({
                                                                                                ...whitelistCheck,
                                                                                                result: Boolean(flag),
                                                                                            });
                                                                                        }
                                                                                        catch (err) {
                                                                                            console.error(err);
                                                                                            setWhitelistCheck({
                                                                                                ...whitelistCheck,
                                                                                                result: undefined,
                                                                                            });
                                                                                            setError("ホワイトリスト確認に失敗しました。");
                                                                                        }
                                                                                    }, children: "\u78BA\u8A8D" })] }), whitelistCheck.result !== undefined ? (_jsxs("div", { children: ["\u7D50\u679C:", " ", whitelistCheck.result
                                                                                    ? "リスト入り"
                                                                                    : "リスト外"] })) : null] }), _jsxs("label", { children: ["Token ID", _jsx("input", { value: formWhitelist.tokenId, onChange: (e) => setFormWhitelist({
                                                                                ...formWhitelist,
                                                                                tokenId: e.target.value,
                                                                            }) })] }), _jsxs("label", { children: ["\u30A2\u30C9\u30EC\u30B9\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09", _jsx("textarea", { rows: 2, value: formWhitelist.addresses, placeholder: "0x..., 0x..., 0x...", onChange: (e) => setFormWhitelist({
                                                                                ...formWhitelist,
                                                                                addresses: e.target.value,
                                                                            }) })] }), _jsxs("label", { children: ["\u30E2\u30FC\u30C9", _jsxs("select", { value: formWhitelist.mode, onChange: (e) => setFormWhitelist({
                                                                                ...formWhitelist,
                                                                                mode: e.target.value,
                                                                            }), children: [_jsx("option", { value: "add", children: "\u8FFD\u52A0" }), _jsx("option", { value: "remove", children: "\u524A\u9664" })] })] }), _jsx("button", { className: "btn", disabled: !formWhitelist.tokenId || !formWhitelist.addresses, onClick: () => withTx(async (c) => {
                                                                        const list = formWhitelist.addresses
                                                                            .split(",")
                                                                            .map((s) => s.trim())
                                                                            .filter(Boolean);
                                                                        if (formWhitelist.mode === "add") {
                                                                            await c.addToWhitelist(Number(formWhitelist.tokenId), list);
                                                                        }
                                                                        else {
                                                                            await c.removeFromWhitelist(Number(formWhitelist.tokenId), list);
                                                                        }
                                                                    }), children: "\u5B9F\u884C" })] })] })) : null, adminSection === "svg" ? (_jsxs("div", { className: "admin-section", children: [_jsx("h3", { children: "SVG \u30A2\u30C3\u30D7\u30ED\u30FC\u30C9" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["Token ID", _jsx("input", { value: formSvg.tokenId, onChange: (e) => setFormSvg({
                                                                                ...formSvg,
                                                                                tokenId: e.target.value,
                                                                            }) })] }), _jsxs("label", { children: ["\u30C1\u30E3\u30F3\u30AF\u756A\u53F7\uFF080 \u304B\u3089\u958B\u59CB\u3002\u30C7\u30FC\u30BF\u304C\u5927\u304D\u3044\u5834\u5408\u306F\u5206\u5272\u3057\u3066\u8907\u6570\u56DE\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\uFF09", _jsx("input", { value: formSvg.chunkIndex, onChange: (e) => setFormSvg({
                                                                                ...formSvg,
                                                                                chunkIndex: e.target.value,
                                                                            }) })] }), _jsxs("label", { children: ["\u30C1\u30E3\u30F3\u30AF\u30C7\u30FC\u30BF\uFF08SVG \u30C6\u30AD\u30B9\u30C8\u307E\u305F\u306F hex \u53EF\u3002\u30C1\u30A7\u30FC\u30F3\u306E gas \u5236\u9650\u306B\u3088\u308A 1 \u56DE\u3042\u305F\u308A\u7D04 30KB \u307E\u3067\u63A8\u5968\uFF09", _jsx("textarea", { rows: 3, value: formSvg.chunkData, maxLength: MAX_CHUNK_CHARS, onChange: (e) => setFormSvg({
                                                                                ...formSvg,
                                                                                chunkData: e.target.value,
                                                                            }) }), _jsxs("span", { className: "hint", children: ["\u5165\u529B\u4E0A\u9650: \u7D0430KB\uFF08", MAX_CHUNK_CHARS, "\u6587\u5B57\u76EE\u5B89\uFF09"] })] }), _jsxs("div", { className: "split-buttons", style: { gap: 8 }, children: [_jsx("button", { className: "btn", style: { flex: "1 1 240px" }, disabled: !formSvg.tokenId || !formSvg.chunkData, onClick: () => withTx(async (c) => {
                                                                                const chunkInput = formSvg.chunkData.trim();
                                                                                const payload = chunkInput.startsWith("0x")
                                                                                    ? chunkInput
                                                                                    : toUtf8Bytes(chunkInput);
                                                                                await c.addSvgChunk(Number(formSvg.tokenId), Number(formSvg.chunkIndex || 0), payload);
                                                                            }), children: "\u30B9\u30C6\u30C3\u30D71: \u30C1\u30E3\u30F3\u30AF\u8FFD\u52A0" }), _jsx("button", { className: "btn btn-secondary", style: { flex: "1 1 240px" }, disabled: !formSvg.tokenId, onClick: () => withTx(async (c) => {
                                                                                await c.finalizeSvgUpload(Number(formSvg.tokenId));
                                                                            }), children: "\u30B9\u30C6\u30C3\u30D72: \u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u5B8C\u4E86\uFF08\u4EE5\u964D\u306F\u5909\u66F4\u4E0D\u53EF\uFF09" })] })] })] })) : null, adminSection === "airdrop" ? (_jsxs("div", { className: "admin-section", children: [_jsx("h3", { children: "\u30A8\u30A2\u30C9\u30ED\u30C3\u30D7" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["Token ID", _jsx("input", { value: formAirdrop.tokenId, onChange: (e) => setFormAirdrop({
                                                                                ...formAirdrop,
                                                                                tokenId: e.target.value,
                                                                            }) })] }), _jsxs("label", { children: ["\u53D7\u53D6\u30A2\u30C9\u30EC\u30B9\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09", _jsx("textarea", { rows: 2, value: formAirdrop.recipients, placeholder: "0x..., 0x..., 0x...", onChange: (e) => setFormAirdrop({
                                                                                ...formAirdrop,
                                                                                recipients: e.target.value,
                                                                            }) })] }), _jsx("button", { className: "btn", disabled: !formAirdrop.tokenId || !formAirdrop.recipients, onClick: () => withTx(async (c) => {
                                                                        const list = formAirdrop.recipients
                                                                            .split(",")
                                                                            .map((s) => s.trim())
                                                                            .filter(Boolean);
                                                                        await c.airdrop(Number(formAirdrop.tokenId), list);
                                                                    }), children: "\u5B9F\u884C" })] })] })) : null, adminSection === "admins" ? (_jsxs("div", { className: "admin-section", children: [_jsx("h3", { children: "\u7BA1\u7406\u8005\u7BA1\u7406" }), _jsxs("div", { className: "notice", style: {
                                                                display: "flex",
                                                                flexDirection: "column",
                                                                gap: 8,
                                                            }, children: [_jsx("strong", { children: "\u7BA1\u7406\u6A29\u9650\u306E\u78BA\u8A8D" }), _jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [_jsx("input", { className: "input-inline", style: { flex: "1 1 220px" }, placeholder: "\u30A6\u30A9\u30EC\u30C3\u30C8\u30A2\u30C9\u30EC\u30B9", value: formAdmins.address, onChange: (e) => setFormAdmins({
                                                                                ...formAdmins,
                                                                                address: e.target.value,
                                                                            }) }), _jsx("button", { className: "btn btn-secondary", disabled: !formAdmins.address, onClick: async () => {
                                                                                try {
                                                                                    const flag = await readContract.isAdmin(formAdmins.address);
                                                                                    setAdminCheckResult(Boolean(flag));
                                                                                }
                                                                                catch (err) {
                                                                                    console.error(err);
                                                                                    setError("管理者確認に失敗しました。");
                                                                                    setAdminCheckResult(undefined);
                                                                                }
                                                                            }, children: "\u7BA1\u7406\u8005\u304B\u78BA\u8A8D" })] }), adminCheckResult !== undefined ? (_jsxs("div", { children: ["\u7D50\u679C:", " ", adminCheckResult
                                                                            ? "管理者です"
                                                                            : "管理者ではありません"] })) : null] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["\u30A2\u30C9\u30EC\u30B9", _jsx("input", { className: "input-inline", value: formAdmins.address, placeholder: "0x...", onChange: (e) => setFormAdmins({
                                                                                ...formAdmins,
                                                                                address: e.target.value,
                                                                            }) })] }), _jsxs("label", { children: ["\u64CD\u4F5C", _jsxs("select", { value: formAdmins.mode, onChange: (e) => setFormAdmins({
                                                                                ...formAdmins,
                                                                                mode: e.target.value,
                                                                            }), children: [_jsx("option", { value: "add", children: "\u8FFD\u52A0" }), _jsx("option", { value: "remove", children: "\u524A\u9664" })] })] }), _jsx("button", { className: "btn", disabled: !formAdmins.address, onClick: () => withTx(async (c) => {
                                                                        if (formAdmins.mode === "add") {
                                                                            await c.addAdmin(formAdmins.address);
                                                                        }
                                                                        else {
                                                                            await c.removeAdmin(formAdmins.address);
                                                                        }
                                                                    }), children: "\u5B9F\u884C" })] })] })) : null, adminSection === "contract" ? (_jsxs("div", { className: "admin-section", children: [_jsx("h3", { children: "\u7DCA\u6025\u505C\u6B62\uFF08\u30AA\u30FC\u30CA\u30FC\u306E\u307F\u64CD\u4F5C\u53EF\u80FD\uFF09" }), _jsx("p", { children: "\u7DCA\u6025\u6642\u306B\u30AF\u30EC\u30FC\u30E0\u30FB\u30A8\u30A2\u30C9\u30ED\u30C3\u30D7\u3092\u505C\u6B62\u53EF\u80FD" }), _jsxs("p", { children: ["\u73FE\u5728\u306E\u72B6\u614B:", " ", isPaused === undefined
                                                                    ? "取得中"
                                                                    : isPaused
                                                                        ? "一時停止中"
                                                                        : "稼働中"] }), _jsxs("div", { className: "split-buttons", children: [_jsx("button", { className: "btn", style: { flex: "1 1 240px" }, disabled: !isOwner || isPaused, onClick: () => withTx(async (c) => {
                                                                        if (!isOwner) {
                                                                            setError("オーナーのみ実行できます。");
                                                                            return;
                                                                        }
                                                                        await c.pause();
                                                                        setIsPaused(true);
                                                                    }), children: "\u7DCA\u6025\u505C\u6B62 (pause)" }), _jsx("button", { className: "btn btn-secondary", style: { flex: "1 1 240px" }, disabled: !isOwner || isPaused === false, onClick: () => withTx(async (c) => {
                                                                        if (!isOwner) {
                                                                            setError("オーナーのみ実行できます。");
                                                                            return;
                                                                        }
                                                                        await c.unpause();
                                                                        setIsPaused(false);
                                                                    }), children: "\u518D\u958B (unpause)" }), !isOwner ? (_jsx("div", { className: "hint", children: "\u203B \u30AA\u30FC\u30CA\u30FC\u306E\u307F\u5B9F\u884C\u53EF\u80FD" })) : null] }), _jsx("div", { className: "section-divider" }), _jsx("h3", { children: "\u30B3\u30F3\u30C8\u30E9\u30AF\u30C8\u6240\u6709\u6A29\u3092\u79FB\u8EE2\uFF08\u30AA\u30FC\u30CA\u30FC\u306E\u307F\u64CD\u4F5C\u53EF\u80FD\uFF09" }), _jsxs("p", { children: ["\u73FE\u5728\u306E\u30B3\u30F3\u30C8\u30E9\u30AF\u30C8\u30AA\u30FC\u30CA\u30FC:", " ", renderAddress(ownerAddress, "取得中", "contract-owner")] }), _jsxs("div", { style: { marginTop: 20 }, className: "form-grid", children: [_jsxs("label", { style: { gridColumn: "span 2" }, children: ["\u65B0\u3057\u3044\u30AA\u30FC\u30CA\u30FC\u30A2\u30C9\u30EC\u30B9", _jsx("input", { value: formTransferOwner, onChange: (e) => setFormTransferOwner(e.target.value), className: "input-inline", placeholder: "0x..." })] }), _jsx("button", { className: "btn", style: { gridColumn: "span 2" }, disabled: !isOwner || !formTransferOwner, onClick: () => withTx(async (c) => {
                                                                        if (!isOwner) {
                                                                            setError("オーナーのみ実行できます。");
                                                                            return;
                                                                        }
                                                                        await c.transferOwnership(formTransferOwner);
                                                                        setOwnerAddress(formTransferOwner);
                                                                        setFormTransferOwner("");
                                                                    }), children: "\u6240\u6709\u6A29\u3092\u79FB\u8EE2\u3059\u308B" })] })] })) : null] })] })) : null] })] }) }), _jsx(SiteFooter, {})] }));
}
