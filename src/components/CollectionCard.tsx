import type { CollectionView } from "../lib/contracts";

type Props = {
  collection: CollectionView;
  onClaim?: (tokenId: number) => void;
  isClaiming?: boolean;
  showClaimAction?: boolean;
  connected?: boolean;
};

export function CollectionCard({
  collection,
  onClaim,
  isClaiming,
  showClaimAction,
  connected,
}: Props) {
  const {
    tokenId,
    name,
    description,
    imageSrc,
    isActive,
    isWhitelistEnabled,
    maxSupply,
    currentSupply,
    hasClaimed,
    isWhitelisted,
    isSvgFinalized,
  } = collection;

  const remaining =
    maxSupply === 0 ? "∞" : Math.max(maxSupply - currentSupply, 0);
  const canClaim =
    showClaimAction &&
    connected &&
    isActive &&
    isSvgFinalized &&
    (!isWhitelistEnabled || isWhitelisted) &&
    !hasClaimed &&
    (maxSupply === 0 || currentSupply < maxSupply);

  const reasons: string[] = [];
  if (!isActive) reasons.push("受付停止中");
  if (!isSvgFinalized) reasons.push("SVG未確定");
  if (isWhitelistEnabled && !isWhitelisted) reasons.push("ホワイトリスト対象外");
  if (hasClaimed) reasons.push("すでに受領済み");
  if (maxSupply !== 0 && currentSupply >= maxSupply) reasons.push("在庫なし");
  if (!connected) reasons.push("ウォレット未接続");
  const reasonText = reasons.length ? reasons.join(" / ") : undefined;

  return (
    <div className="collection-card card">
      <div className="thumb">
        {imageSrc ? (
          <img src={imageSrc} alt={name} />
        ) : (
          <div
            style={{
              display: "grid",
              placeItems: "center",
              height: "100%",
              color: "var(--muted)",
              fontWeight: 700,
            }}
          >
            SVG 準備中
          </div>
        )}
      </div>
      <div className="collection-meta">
        <span className="tag">ID #{tokenId}</span>
        <span className="tag">鋳造済み {currentSupply}</span>
        <span className="tag">
          残り {remaining} / {maxSupply === 0 ? "∞" : maxSupply}
        </span>
        <span className={`tag ${isActive ? "success" : "danger"}`}>
          {isActive ? "受付中" : "停止中"}
        </span>
        {isWhitelistEnabled ? (
          <span className="tag warn">ホワイトリスト</span>
        ) : (
          <span className="tag success">誰でも</span>
        )}
        {hasClaimed ? <span className="tag success">受領済み</span> : null}
      </div>
      <div>
        <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>{name}</h3>
        <p className="collection-desc">{description}</p>
        <div className="status-line">
          {isWhitelistEnabled ? (
            <span className="tag">
              {isWhitelisted
                ? "リスト入り"
                : connected
                ? "リスト外"
                : "接続して確認"}
            </span>
          ) : null}
        </div>
      </div>
      {showClaimAction ? (
        <div className="actions-row">
          <div className="status-line">
            <span role="img" aria-label="nft">
              🎁
            </span>
            1 アカウント 1 点のみ
         </div>
          <button
            className="btn"
            disabled={!canClaim || isClaiming}
            onClick={() => onClaim?.(tokenId)}
          >
            {hasClaimed
              ? "受領済み"
              : !connected
              ? "接続が必要"
              : isClaiming
              ? "送信中…"
              : isWhitelistEnabled && !isWhitelisted
              ? "対象外"
              : "受け取る"}
          </button>
        </div>
      ) : null}
   </div>
 );
}
