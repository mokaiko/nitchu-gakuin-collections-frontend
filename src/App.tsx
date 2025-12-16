import { useCallback, useEffect, useMemo, useState } from "react";
import { toUtf8Bytes } from "ethers";

const MAX_CHUNK_CHARS = 28000; // 約30KB相当（UTF-8文字数ベース）

import { CollectionCard } from "./components/CollectionCard";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import {
  NETWORKS,
  DEFAULT_CHAIN_ID,
  getNetworkConfig,
} from "./config/networks";
import { useWallet } from "./hooks/useWallet";
import {
  getContract,
  getRpcProvider,
  listCollectionIds,
  loadCollections,
  type CollectionView,
} from "./lib/contracts";
import "./styles/layout.css";

type TabKey = "gallery" | "claim" | "admin";

export default function App() {
  const [tab, setTab] = useState<TabKey>("gallery");
  const readChainId = DEFAULT_CHAIN_ID;
  const [collections, setCollections] = useState<CollectionView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [claimingId, setClaimingId] = useState<number>();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<string>();
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [contractVersion, setContractVersion] = useState<string>();
  const [isPaused, setIsPaused] = useState<boolean>();
  const [adminSection, setAdminSection] = useState<
    | "info"
    | "create"
    | "svg"
    | "status"
    | "whitelist"
    | "airdrop"
    | "admins"
    | "contract"
  >("info");
  const [txMessage, setTxMessage] = useState<string>();
  const canAdmin = useMemo(() => isOwner || isAdmin, [isOwner, isAdmin]);
  const [adminCheckResult, setAdminCheckResult] = useState<boolean | undefined>(
    undefined
  );

  const {
    account,
    chainId,
    provider,
    connect,
    disconnect,
    isConnecting,
    error: walletError,
    isMetaMaskAvailable,
  } = useWallet();

  const network = useMemo(() => getNetworkConfig(readChainId), [readChainId]);
  const readProvider = useMemo(
    () => getRpcProvider(network.chainId),
    [network.chainId]
  );
  const readContract = useMemo(
    () => getContract(network.chainId, readProvider),
    [network.chainId, readProvider]
  );

  const refreshCollections = useCallback(async () => {
    if (!readContract) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const ids = await listCollectionIds(readContract);
      const data = ids.length
        ? await loadCollections(readContract, ids, account)
        : [];
      setCollections(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError(
        "コレクション情報の取得に失敗しました。RPCやネットワーク設定を確認してください。"
      );
    } finally {
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
    } catch (err) {
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

  const handleClaim = useCallback(
    async (tokenId: number) => {
      if (!provider) {
        setError(
          "MetaMask が検知できません。ブラウザ拡張を有効にしてください。"
        );
        return;
      }
      const targetNetwork = getNetworkConfig(readChainId);
      if (chainId !== targetNetwork.chainId) {
        setError(
          `${targetNetwork.name} にネットワークを切り替えてから実行してください。`
        );
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
      } catch (err: any) {
        console.error(err);
        const message =
          err?.info?.error?.message ||
          err?.reason ||
          err?.shortMessage ||
          "トランザクションが失敗しました。残数・ホワイトリスト・ネットワークを確認してください。";
        setError(message);
      } finally {
        setClaimingId(undefined);
      }
    },
    [chainId, provider, readChainId, refreshCollections]
  );

  const claimableCollections = useMemo(() => {
    // 受付中かつ SVG 確定済みのものを全て表示。受領可否はカード側で理由付き表示。
    return collections.filter((item) => item.isActive && item.isSvgFinalized);
  }, [collections]);

  const finalizedCollections = useMemo(
    () => collections.filter((item) => item.isSvgFinalized),
    [collections]
  );

  const ensureAuthorized = (): string | null => {
    if (!account) return "MetaMask を接続してください。";
    if (!isOwner && !isAdmin)
      return "この機能はオーナーまたは管理者のみ利用できます。";
    if (chainId !== network.chainId)
      return `${network.name} に切り替えてください。`;
    return null;
  };

  const withTx = async (fn: (contract: any) => Promise<void>) => {
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
    } catch (err: any) {
      console.error(err);
      const message =
        err?.info?.error?.message ||
        err?.reason ||
        err?.shortMessage ||
        "トランザクションに失敗しました。";
      setError(message);
    } finally {
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
  const [statusCheck, setStatusCheck] = useState<{
    tokenId: string;
    result?: {
      whitelist: boolean;
      active: boolean;
      svgFinalized: boolean;
      maxSupply: number;
      currentSupply: number;
    };
  }>({
    tokenId: "",
  });

  const [formWhitelist, setFormWhitelist] = useState({
    tokenId: "",
    addresses: "",
    mode: "add" as "add" | "remove",
  });
  const [whitelistCheck, setWhitelistCheck] = useState<{
    tokenId: string;
    address: string;
    result?: boolean;
  }>({
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
    mode: "add" as "add" | "remove",
  });
  const [formTransferOwner, setFormTransferOwner] = useState("");

  return (
    <div className="page-shell">
      <SiteHeader
        onConnect={connect}
        onDisconnect={disconnect}
        account={account}
        isConnecting={isConnecting}
      />
      <main className="content">
        <div className="container">
          <div className="page-hero">
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              <div className="badge">日中学院デジタルコレクション</div>
              <div className="badge accent">Optimism ERC-1155</div>
            </div>
            <h1 className="title">コレクション一覧と受け取り</h1>
            <p className="subtitle">
              Optimism 上の日中学院 ERC-1155
              コレクションを閲覧・受け取りできます。MetaMask
              を接続し、受領可能な NFT を請求してください。
            </p>
            <div className="cta-row">
              <div className="network-chip">
                コントラクト: <strong>{network.contractAddress}</strong>
              </div>
              {network.explorer ? (
                <a
                  className="network-chip"
                  href={`${network.explorer}/address/${network.contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  ブロックエクスプローラー
                </a>
              ) : null}
            </div>
          </div>

          <div className="tab-bar">
            <button
              className={`tab-btn ${tab === "gallery" ? "active" : ""}`}
              onClick={() => setTab("gallery")}
            >
              コレクション一覧
            </button>
            <button
              className={`tab-btn ${tab === "claim" ? "active" : ""}`}
              onClick={() => setTab("claim")}
            >
              受け取り
            </button>
            {canAdmin ? (
              <button
                className={`tab-btn ${tab === "admin" ? "active" : ""}`}
                onClick={() => setTab("admin")}
              >
                管理
              </button>
            ) : null}
          </div>

          <div className="panel">
            <div className="cta-row" style={{ marginBottom: 8 }}>
              <div className="section-title">
                {tab === "gallery"
                  ? "コレクション一覧 (ID 昇順)"
                  : tab === "claim"
                  ? "受領可能なコレクション"
                  : "管理メニュー"}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {lastUpdated ? (
                  <span className="hint">
                    最終更新: {lastUpdated.toLocaleTimeString()}
                  </span>
                ) : null}
                <button
                  className="btn btn-secondary"
                  onClick={() => refreshCollections()}
                  disabled={isLoading}
                >
                  {isLoading ? "更新中…" : "最新の状態を取得"}
                </button>
              </div>
            </div>
            {error ? <div className="notice">{error}</div> : null}

            {tab === "gallery" ? (
              <div className="collections-grid">
                {isLoading ? (
                  <div className="notice">読み込み中…</div>
                ) : finalizedCollections.length === 0 ? (
                  <div className="notice">
                    表示できるコレクションがまだありません。
                  </div>
                ) : (
                  <div className="grid gallery">
                    {finalizedCollections.map((item) => (
                      <CollectionCard
                        key={item.tokenId}
                        collection={item}
                        showClaimAction={false}
                        connected={Boolean(account)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {tab === "claim" ? (
              <div className="collections-grid">
                {walletError ? (
                  <div className="notice">{walletError}</div>
                ) : null}
                {!isMetaMaskAvailable ? (
                  <div className="notice">
                    MetaMask
                    が見つかりません。拡張機能をインストールしてください。
                  </div>
                ) : null}
                {!account ? (
                  <div className="notice">
                    MetaMask を接続すると受け取り可否を判定します。
                  </div>
                ) : null}
                {isLoading ? (
                  <div className="notice">読み込み中…</div>
                ) : claimableCollections.length === 0 ? (
                  <div className="notice">
                    現在受領できる NFT はありません。
                  </div>
                ) : (
                  <div className="grid gallery">
                    {claimableCollections.map((item) => (
                      <CollectionCard
                        key={item.tokenId}
                        collection={item}
                        showClaimAction
                        onClaim={handleClaim}
                        isClaiming={claimingId === item.tokenId}
                        connected={Boolean(account)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {tab === "admin" ? (
              <div className="admin-layout">
                <div className="admin-menu">
                  <button
                    className={
                      adminSection === "info" ? "menu-btn active" : "menu-btn"
                    }
                    onClick={() => setAdminSection("info")}
                  >
                    <span className="icon icon-info" aria-hidden="true" />{" "}
                    コントラクト情報
                  </button>
                  <button
                    className={
                      adminSection === "create" ? "menu-btn active" : "menu-btn"
                    }
                    onClick={() => setAdminSection("create")}
                  >
                    <span className="icon icon-new" aria-hidden="true" />{" "}
                    新規作成
                  </button>
                  <button
                    className={
                      adminSection === "svg" ? "menu-btn active" : "menu-btn"
                    }
                    onClick={() => setAdminSection("svg")}
                  >
                    <span className="icon icon-image" aria-hidden="true" />{" "}
                    SVGアップロード
                  </button>
                  <button
                    className={
                      adminSection === "status" ? "menu-btn active" : "menu-btn"
                    }
                    onClick={() => setAdminSection("status")}
                  >
                    <span className="icon icon-toggle" aria-hidden="true" />{" "}
                    状態更新
                  </button>
                  <button
                    className={
                      adminSection === "whitelist"
                        ? "menu-btn active"
                        : "menu-btn"
                    }
                    onClick={() => setAdminSection("whitelist")}
                  >
                    <span className="icon icon-list" aria-hidden="true" />{" "}
                    ホワイトリスト
                  </button>
                  <button
                    className={
                      adminSection === "airdrop"
                        ? "menu-btn active"
                        : "menu-btn"
                    }
                    onClick={() => setAdminSection("airdrop")}
                  >
                    <span className="icon icon-gift" aria-hidden="true" />{" "}
                    エアドロップ
                  </button>
                  <button
                    className={
                      adminSection === "admins" ? "menu-btn active" : "menu-btn"
                    }
                    onClick={() => setAdminSection("admins")}
                  >
                    <span className="icon icon-admin" aria-hidden="true" />{" "}
                    管理者管理
                  </button>
                  <button
                    className={
                      adminSection === "contract"
                        ? "menu-btn active"
                        : "menu-btn"
                    }
                    onClick={() => setAdminSection("contract")}
                  >
                    <span className="icon icon-settings" aria-hidden="true" />{" "}
                    コントラクト管理
                  </button>
                </div>
                <div className="admin-body">
                  <div className="notice">
                    <div>現在の接続: {account ?? "未接続"}</div>
                    <div>
                      接続の権限:{" "}
                      {isOwner ? "オーナー" : isAdmin ? "管理者" : "なし"}
                    </div>
                  </div>
                  {txMessage ? <div className="notice">{txMessage}</div> : null}

                  {adminSection === "info" ? (
                    <div className="admin-section">
                      <h3>コントラクト情報</h3>
                      <p>ネットワーク: {network.name}</p>
                      <p>アドレス: {network.contractAddress}</p>
                      <p>Owner: {ownerAddress ?? "取得中"}</p>
                      <p>バージョン: {contractVersion ?? "取得中"}</p>
                    </div>
                  ) : null}

                  {adminSection === "create" ? (
                    <div className="admin-section">
                      <h3>新規コレクション作成</h3>
                      <div className="form-grid">
                        <label>
                          名前
                          <input
                            value={formCreate.name}
                            onChange={(e) =>
                              setFormCreate({
                                ...formCreate,
                                name: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          説明
                          <textarea
                            value={formCreate.description}
                            onChange={(e) =>
                              setFormCreate({
                                ...formCreate,
                                description: e.target.value,
                              })
                            }
                            rows={2}
                          />
                        </label>
                        <label>
                          最大供給 (0 で無制限)
                          <input
                            type="number"
                            value={formCreate.maxSupply}
                            onChange={(e) =>
                              setFormCreate({
                                ...formCreate,
                                maxSupply: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="toggle-row">
                          <span>
                            ホワイトリスト有効（指定ユーザーのみ受領可）
                          </span>
                          <input
                            className="toggle-switch"
                            type="checkbox"
                            checked={formCreate.whitelist}
                            onChange={(e) =>
                              setFormCreate({
                                ...formCreate,
                                whitelist: e.target.checked,
                              })
                            }
                          />
                        </label>
                        <label className="toggle-row">
                          <span>アクティブ（作成直後から受領可能）</span>
                          <input
                            className="toggle-switch"
                            type="checkbox"
                            checked={formCreate.active}
                            onChange={(e) =>
                              setFormCreate({
                                ...formCreate,
                                active: e.target.checked,
                              })
                            }
                          />
                        </label>
                        <button
                          className="btn"
                          disabled={!formCreate.name || !formCreate.description}
                          onClick={() =>
                            withTx(async (c) => {
                              await c.createCollection(
                                formCreate.name,
                                formCreate.description,
                                BigInt(formCreate.maxSupply || 0),
                                formCreate.whitelist,
                                formCreate.active
                              );
                              setFormCreate({
                                name: "",
                                description: "",
                                maxSupply: "",
                                whitelist: false,
                                active: true,
                              });
                            })
                          }
                        >
                          作成
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {adminSection === "status" ? (
                    <div className="admin-section">
                      <h3>状態更新</h3>
                      <div className="form-grid">
                        <div
                          className="notice"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          <strong>現在の状態確認</strong>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <input
                              className="input-inline"
                              style={{ flex: "1 1 160px" }}
                              placeholder="Token ID"
                              value={statusCheck.tokenId}
                              onChange={(e) =>
                                setStatusCheck({
                                  ...statusCheck,
                                  tokenId: e.target.value,
                                  result: undefined,
                                })
                              }
                            />
                            <button
                              className="btn btn-secondary"
                              disabled={!statusCheck.tokenId}
                              onClick={async () => {
                                try {
                                  const info =
                                    await readContract.getCollectionInfo(
                                      Number(statusCheck.tokenId)
                                    );
                                  setStatusCheck({
                                    ...statusCheck,
                                    result: {
                                      whitelist: Boolean(
                                        info.isWhitelistEnabled ?? info[4]
                                      ),
                                      active: Boolean(info.isActive ?? info[5]),
                                      svgFinalized: Boolean(
                                        info.isSvgFinalized ?? info[7]
                                      ),
                                      maxSupply: Number(
                                        info.maxSupply ?? info[2] ?? 0n
                                      ),
                                      currentSupply: Number(
                                        info.currentSupply ?? info[3] ?? 0n
                                      ),
                                    },
                                  });
                                } catch (err) {
                                  console.error(err);
                                  setStatusCheck({
                                    ...statusCheck,
                                    result: undefined,
                                  });
                                  setError("状態の取得に失敗しました。");
                                }
                              }}
                            >
                              確認
                            </button>
                          </div>
                          {statusCheck.result ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              <span>
                                アクティブ:{" "}
                                {statusCheck.result.active ? "はい" : "いいえ"}
                              </span>
                              <span>
                                ホワイトリスト有効:{" "}
                                {statusCheck.result.whitelist
                                  ? "はい"
                                  : "いいえ"}
                              </span>
                              <span>
                                SVG 確定:{" "}
                                {statusCheck.result.svgFinalized
                                  ? "はい"
                                  : "いいえ"}
                              </span>
                              <span>
                                供給: {statusCheck.result.currentSupply} /{" "}
                                {statusCheck.result.maxSupply === 0
                                  ? "∞"
                                  : statusCheck.result.maxSupply}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <label>
                          Token ID
                          <input
                            className="input-inline"
                            value={formStatus.tokenId}
                            onChange={(e) =>
                              setFormStatus({
                                ...formStatus,
                                tokenId: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="toggle-row">
                          <span>
                            ホワイトリスト有効（指定ユーザーのみ受領可）
                          </span>
                          <input
                            className="toggle-switch"
                            type="checkbox"
                            checked={formStatus.whitelist}
                            onChange={(e) =>
                              setFormStatus({
                                ...formStatus,
                                whitelist: e.target.checked,
                              })
                            }
                          />
                        </label>
                        <label className="toggle-row">
                          <span>アクティブ（作成直後から受領可能）</span>
                          <input
                            className="toggle-switch"
                            type="checkbox"
                            checked={formStatus.active}
                            onChange={(e) =>
                              setFormStatus({
                                ...formStatus,
                                active: e.target.checked,
                              })
                            }
                          />
                        </label>
                        <button
                          className="btn"
                          disabled={!formStatus.tokenId}
                          onClick={() =>
                            withTx(async (c) => {
                              await c.updateCollectionStatus(
                                Number(formStatus.tokenId),
                                formStatus.whitelist,
                                formStatus.active
                              );
                            })
                          }
                        >
                          更新
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {adminSection === "whitelist" ? (
                    <div className="admin-section">
                      <h3>ホワイトリスト管理</h3>
                      <div className="form-grid">
                        <div
                          className="notice"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          <strong>アドレス確認</strong>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <input
                              className="input-inline"
                              style={{ flex: "1 1 160px" }}
                              placeholder="Token ID"
                              value={whitelistCheck.tokenId}
                              onChange={(e) =>
                                setWhitelistCheck({
                                  ...whitelistCheck,
                                  tokenId: e.target.value,
                                })
                              }
                            />
                            <input
                              className="input-inline"
                              style={{ flex: "2 1 220px" }}
                              placeholder="アドレス"
                              value={whitelistCheck.address}
                              onChange={(e) =>
                                setWhitelistCheck({
                                  ...whitelistCheck,
                                  address: e.target.value,
                                })
                              }
                            />
                            <button
                              className="btn btn-secondary"
                              disabled={
                                !whitelistCheck.tokenId ||
                                !whitelistCheck.address
                              }
                              onClick={async () => {
                                try {
                                  const flag = await readContract.isWhitelisted(
                                    Number(whitelistCheck.tokenId),
                                    whitelistCheck.address
                                  );
                                  setWhitelistCheck({
                                    ...whitelistCheck,
                                    result: Boolean(flag),
                                  });
                                } catch (err) {
                                  console.error(err);
                                  setWhitelistCheck({
                                    ...whitelistCheck,
                                    result: undefined,
                                  });
                                  setError(
                                    "ホワイトリスト確認に失敗しました。"
                                  );
                                }
                              }}
                            >
                              確認
                            </button>
                          </div>
                          {whitelistCheck.result !== undefined ? (
                            <div>
                              結果:{" "}
                              {whitelistCheck.result
                                ? "リスト入り"
                                : "リスト外"}
                            </div>
                          ) : null}
                        </div>
                        <label>
                          Token ID
                          <input
                            value={formWhitelist.tokenId}
                            onChange={(e) =>
                              setFormWhitelist({
                                ...formWhitelist,
                                tokenId: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          アドレス（カンマ区切り）
                          <textarea
                            rows={2}
                            value={formWhitelist.addresses}
                            placeholder="0x..., 0x..., 0x..."
                            onChange={(e) =>
                              setFormWhitelist({
                                ...formWhitelist,
                                addresses: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          モード
                          <select
                            value={formWhitelist.mode}
                            onChange={(e) =>
                              setFormWhitelist({
                                ...formWhitelist,
                                mode: e.target.value as "add" | "remove",
                              })
                            }
                          >
                            <option value="add">追加</option>
                            <option value="remove">削除</option>
                          </select>
                        </label>
                        <button
                          className="btn"
                          disabled={
                            !formWhitelist.tokenId || !formWhitelist.addresses
                          }
                          onClick={() =>
                            withTx(async (c) => {
                              const list = formWhitelist.addresses
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean);
                              if (formWhitelist.mode === "add") {
                                await c.addToWhitelist(
                                  Number(formWhitelist.tokenId),
                                  list
                                );
                              } else {
                                await c.removeFromWhitelist(
                                  Number(formWhitelist.tokenId),
                                  list
                                );
                              }
                            })
                          }
                        >
                          実行
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {adminSection === "svg" ? (
                    <div className="admin-section">
                      <h3>SVG アップロード</h3>
                      <div className="form-grid">
                        <label>
                          Token ID
                          <input
                            value={formSvg.tokenId}
                            onChange={(e) =>
                              setFormSvg({
                                ...formSvg,
                                tokenId: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          チャンク番号（0
                          から開始。データが大きい場合は分割して複数回アップロード）
                          <input
                            value={formSvg.chunkIndex}
                            onChange={(e) =>
                              setFormSvg({
                                ...formSvg,
                                chunkIndex: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          チャンクデータ（SVG テキストまたは hex 可。チェーンの
                          gas 制限により 1 回あたり約 30KB まで推奨）
                          <textarea
                            rows={3}
                            value={formSvg.chunkData}
                            maxLength={MAX_CHUNK_CHARS}
                            onChange={(e) =>
                              setFormSvg({
                                ...formSvg,
                                chunkData: e.target.value,
                              })
                            }
                          />
                          <span className="hint">
                            入力上限: 約30KB（{MAX_CHUNK_CHARS}文字目安）
                          </span>
                        </label>
                        <div className="split-buttons" style={{ gap: 8 }}>
                          <button
                            className="btn"
                            style={{ flex: "1 1 240px" }}
                            disabled={!formSvg.tokenId || !formSvg.chunkData}
                            onClick={() =>
                              withTx(async (c) => {
                                const chunkInput = formSvg.chunkData.trim();
                                const payload = chunkInput.startsWith("0x")
                                  ? chunkInput
                                  : toUtf8Bytes(chunkInput);
                                await c.addSvgChunk(
                                  Number(formSvg.tokenId),
                                  Number(formSvg.chunkIndex || 0),
                                  payload
                                );
                              })
                            }
                          >
                            ステップ1: チャンク追加
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ flex: "1 1 240px" }}
                            disabled={!formSvg.tokenId}
                            onClick={() =>
                              withTx(async (c) => {
                                await c.finalizeSvgUpload(
                                  Number(formSvg.tokenId)
                                );
                              })
                            }
                          >
                            ステップ2: アップロード完了（以降は変更不可）
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {adminSection === "airdrop" ? (
                    <div className="admin-section">
                      <h3>エアドロップ</h3>
                      <div className="form-grid">
                        <label>
                          Token ID
                          <input
                            value={formAirdrop.tokenId}
                            onChange={(e) =>
                              setFormAirdrop({
                                ...formAirdrop,
                                tokenId: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          受取アドレス（カンマ区切り）
                          <textarea
                            rows={2}
                            value={formAirdrop.recipients}
                            placeholder="0x..., 0x..., 0x..."
                            onChange={(e) =>
                              setFormAirdrop({
                                ...formAirdrop,
                                recipients: e.target.value,
                              })
                            }
                          />
                        </label>
                        <button
                          className="btn"
                          disabled={
                            !formAirdrop.tokenId || !formAirdrop.recipients
                          }
                          onClick={() =>
                            withTx(async (c) => {
                              const list = formAirdrop.recipients
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean);
                              await c.airdrop(
                                Number(formAirdrop.tokenId),
                                list
                              );
                            })
                          }
                        >
                          実行
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {adminSection === "admins" ? (
                    <div className="admin-section">
                      <h3>管理者管理</h3>
                      <div
                        className="notice"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <strong>管理権限の確認</strong>
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          <input
                            className="input-inline"
                            style={{ flex: "1 1 220px" }}
                            placeholder="ウォレットアドレス"
                            value={formAdmins.address}
                            onChange={(e) =>
                              setFormAdmins({
                                ...formAdmins,
                                address: e.target.value,
                              })
                            }
                          />
                          <button
                            className="btn btn-secondary"
                            disabled={!formAdmins.address}
                            onClick={async () => {
                              try {
                                const flag = await readContract.isAdmin(
                                  formAdmins.address
                                );
                                setAdminCheckResult(Boolean(flag));
                              } catch (err) {
                                console.error(err);
                                setError("管理者確認に失敗しました。");
                                setAdminCheckResult(undefined);
                              }
                            }}
                          >
                            管理者か確認
                          </button>
                        </div>
                        {adminCheckResult !== undefined ? (
                          <div>
                            結果:{" "}
                            {adminCheckResult
                              ? "管理者です"
                              : "管理者ではありません"}
                          </div>
                        ) : null}
                      </div>
                      <div className="form-grid">
                        <label>
                          アドレス
                          <input
                            className="input-inline"
                            value={formAdmins.address}
                            placeholder="0x..."
                            onChange={(e) =>
                              setFormAdmins({
                                ...formAdmins,
                                address: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          操作
                          <select
                            value={formAdmins.mode}
                            onChange={(e) =>
                              setFormAdmins({
                                ...formAdmins,
                                mode: e.target.value as "add" | "remove",
                              })
                            }
                          >
                            <option value="add">追加</option>
                            <option value="remove">削除</option>
                          </select>
                        </label>
                        <button
                          className="btn"
                          disabled={!formAdmins.address}
                          onClick={() =>
                            withTx(async (c) => {
                              if (formAdmins.mode === "add") {
                                await c.addAdmin(formAdmins.address);
                              } else {
                                await c.removeAdmin(formAdmins.address);
                              }
                            })
                          }
                        >
                          実行
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {adminSection === "contract" ? (
                    <div className="admin-section">
                      <h3>緊急停止（オーナーのみ操作可能）</h3>
                      <p>緊急時にクレーム・エアドロップを停止可能</p>
                      <p>
                        現在の状態:{" "}
                        {isPaused === undefined
                          ? "取得中"
                          : isPaused
                          ? "一時停止中"
                          : "稼働中"}
                      </p>
                      <div className="split-buttons">
                        <button
                          className="btn"
                          style={{ flex: "1 1 240px" }}
                          disabled={!isOwner || isPaused}
                          onClick={() =>
                            withTx(async (c) => {
                              if (!isOwner) {
                                setError("オーナーのみ実行できます。");
                                return;
                              }
                              await c.pause();
                              setIsPaused(true);
                            })
                          }
                        >
                          緊急停止 (pause)
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ flex: "1 1 240px" }}
                          disabled={!isOwner || isPaused === false}
                          onClick={() =>
                            withTx(async (c) => {
                              if (!isOwner) {
                                setError("オーナーのみ実行できます。");
                                return;
                              }
                              await c.unpause();
                              setIsPaused(false);
                            })
                          }
                        >
                          再開 (unpause)
                        </button>
                        {!isOwner ? (
                          <div className="hint">※ オーナーのみ実行可能</div>
                        ) : null}
                      </div>
                      <div className="section-divider" />
                      <h3>コントラクト所有権を移転（オーナーのみ操作可能）</h3>
                      <p>現在のコントラクトオーナー: {ownerAddress ?? "取得中"}</p>
                      <div style={{ marginTop: 20 }} className="form-grid">
                        <label style={{ gridColumn: "span 2" }}>
                          新しいオーナーアドレス
                          <input
                            value={formTransferOwner}
                            onChange={(e) =>
                              setFormTransferOwner(e.target.value)
                            }
                            className="input-inline"
                            placeholder="0x..."
                          />
                        </label>
                        <button
                          className="btn"
                          style={{ gridColumn: "span 2" }}
                          disabled={!isOwner || !formTransferOwner}
                          onClick={() =>
                            withTx(async (c) => {
                              if (!isOwner) {
                                setError("オーナーのみ実行できます。");
                                return;
                              }
                              await c.transferOwnership(formTransferOwner);
                              setOwnerAddress(formTransferOwner);
                              setFormTransferOwner("");
                            })
                          }
                        >
                          所有権を移転する
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
