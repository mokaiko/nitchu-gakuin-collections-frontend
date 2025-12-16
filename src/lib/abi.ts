import { type InterfaceAbi } from 'ethers';

export const COLLECTION_ABI: InterfaceAbi = [
  'event CollectionCreated(uint256 indexed tokenId, string name, string description, uint256 maxSupply, bool isWhitelistEnabled, bool isActive)',
  'event CollectionClaimed(uint256 indexed tokenId, address indexed claimer, uint256 amount)',
  'function getCollectionInfo(uint256 tokenId) view returns (string name, string description, uint256 maxSupply, uint256 currentSupply, bool isWhitelistEnabled, bool isActive, uint256 svgChunkCount, bool isSvgFinalized)',
  'function getSvgData(uint256 tokenId) view returns (string)',
  'function hasClaimed(uint256 tokenId, address account) view returns (bool)',
  'function isWhitelisted(uint256 tokenId, address account) view returns (bool)',
  'function isAdmin(address account) view returns (bool)',
  'function claim(uint256 tokenId)',
  'function getVersion() pure returns (string)',
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
  'function paused() view returns (bool)',
  'function pause()',
  'function unpause()',
  'function createCollection(string name,string description,uint256 maxSupply,bool isWhitelistEnabled,bool isActive)',
  'function updateCollectionStatus(uint256 tokenId,bool isWhitelistEnabled,bool isActive)',
  'function addToWhitelist(uint256 tokenId,address[] accounts)',
  'function removeFromWhitelist(uint256 tokenId,address[] accounts)',
  'function addSvgChunk(uint256 tokenId,uint256 chunkIndex,bytes chunkData)',
  'function finalizeSvgUpload(uint256 tokenId)',
  'function airdrop(uint256 tokenId,address[] recipients)',
  'function addAdmin(address admin)',
  'function removeAdmin(address admin)',
  'function uri(uint256 tokenId) view returns (string)'
];
