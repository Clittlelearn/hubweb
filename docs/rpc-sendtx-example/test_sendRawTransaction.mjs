#!/usr/bin/env node
/**
 * eth_sendRawTransaction 业务接口测试 (Node.js 版本)
 *
 * 模拟 MetaMask 的 eth_sendRawTransaction 调用流程。
 *
 * 依赖: npm install ethers@6
 *
 * 用法:
 *   node test_sendRawTransaction.mjs --list
 *   node test_sendRawTransaction.mjs --type stake \
 *     --private-key 0x... --from 0x... --to 0x...
 */

import { ethers } from "ethers";

// ============================================================================
// 配置
// ============================================================================

const CONFIG = {
  rpcUrl: "http://127.0.0.1:13134",
  chainId: 12315,
  privateKey: "0xYOUR_PRIVATE_KEY",
  fromAddress: "0xYOUR_ADDRESS",
  toAddress: "0xRECIPIENT_ADDRESS",
  gasLimit: 300000n,
  maxFeePerGas: ethers.parseUnits("1", "gwei"),
  maxPriorityFeePerGas: ethers.parseUnits("0.5", "gwei"),
};

// ============================================================================
// JSON-RPC 客户端
// ============================================================================

class EthRpcClient {
  constructor(url) {
    this.url = url;
    this._id = 0;
  }

  async call(method, params = []) {
    const resp = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method, params, id: ++this._id,
      }),
    });
    return resp.json();
  }

  async getTransactionCount(address) {
    try {
      const r = await this.call("eth_getTransactionCount", [address, "latest"]);
      return parseInt(r.result || "0x0", 16);
    } catch { return 0; }
  }

  async sendRawTransaction(rawTx) {
    return this.call("eth_sendRawTransaction", [rawTx]);
  }
}

// ============================================================================
// 交易构造器
// ============================================================================

class TxBuilder {
  constructor(config) {
    this.cfg = config;
    this.wallet = new ethers.Wallet(config.privateKey);
    this.rpc = new EthRpcClient(config.rpcUrl);
  }

  async buildAndSign(dataHex, toAddr = "") {
    const nonce = await this.rpc.getTransactionCount(this.cfg.fromAddress);

    const tx = {
      chainId: this.cfg.chainId,
      nonce,
      maxPriorityFeePerGas: this.cfg.maxPriorityFeePerGas,
      maxFeePerGas: this.cfg.maxFeePerGas,
      gasLimit: this.cfg.gasLimit,
      to: toAddr || undefined,
      value: 0n,
      data: dataHex,
      type: 2,
    };

    const signed = await this.wallet.signTransaction(tx);
    // ethers v6 签名后需要再序列化
    const txObj = ethers.Transaction.from(signed);
    return {
      rawTx: signed,
      txHash: txObj.hash,
    };
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

function jsonToHex(obj) {
  return "0x" + Buffer.from(JSON.stringify(obj), "utf-8").toString("hex");
}

function commonFields(opts = {}) {
  const fields = {
    is_find_utxo: opts.isFindUtxo ?? false,
    sponsor_gas: opts.sponsorGas ?? false,
    encoded_info: opts.encodedInfo ?? "",
  };
  if (opts.gasAsset) fields.gas_asset = opts.gasAsset;
  return fields;
}

// ============================================================================
// 测试函数
// ============================================================================

async function testTransaction(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] HandleTransaction — 普通转账");
  const payload = { type: "tx", asset_type: cfg.fromAddress, amount: "1000000", ...commonFields() };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex, cfg.toAddress);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testStake(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] HandleStake — 质押");
  const payload = {
    type: "stake", asset_type: cfg.fromAddress, amount: "100000000",
    reward_rank: "10",
    ...commonFields({ sponsorGas: true, gasAsset: { addr: cfg.fromAddress, asset_type: cfg.fromAddress } }),
  };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testUnstake(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] HandleUnstake — 解除质押");
  const payload = { type: "unstake", asset_type: cfg.fromAddress, stake_utxo_hash: "0x" + "a".repeat(64), ...commonFields() };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testDelegating(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] handleDelegating — 委托");
  const payload = { type: "delegating", asset_type: cfg.fromAddress, amount: "50000000", delegate_type: "1", ...commonFields() };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex, cfg.toAddress);
  console.log(`  to (delegate target): ${cfg.toAddress}`);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testUndelegating(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] HandleUndelegating — 撤销委托");
  const payload = { type: "undelegating", asset_type: cfg.fromAddress, utxo_hash: "0x" + "b".repeat(64), ...commonFields() };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex, cfg.toAddress);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testBonus(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] HandleBonus — 领取奖励");
  const payload = { type: "bonus", asset_type: cfg.fromAddress, first_choose: false, ...commonFields() };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testLock(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] HandleLock — 锁定");
  const payload = { type: "lock", lock_amount: "100000000", lock_type: "1", ...commonFields() };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testUnlock(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] HandleUnLock — 解除锁定");
  const payload = { type: "unlock", utxo_hash: "0x" + "c".repeat(64), ...commonFields() };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testVote(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] HandleVote — 投票");
  const payload = { type: "vote", vote_hash: "0x" + "d".repeat(64), vote: "1", ...commonFields() };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testProposal(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] HandleProposal — 发起提案");
  const payload = { type: "proposal", vote_hash: "0x" + "e".repeat(64), ...commonFields() };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testRevokeProposal(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] revokeProposalRequest — 撤销提案");
  const payload = { type: "revoke_proposal", vote_hash: "0x" + "f".repeat(64), ...commonFields() };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testTreasury(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] HandleTresury — 申领国库奖励");
  const payload = { type: "fund", is_find_utxo: false, encoded_info: "" };
  const dataHex = jsonToHex(payload);
  const { rawTx, txHash } = await builder.buildAndSign(dataHex);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

async function testDeployContract(builder, cfg) {
  console.log("\n" + "=".repeat(60));
  console.log("[TEST] DeployContract — 部署合约");
  const bytecode = "0x6080604052348015600f57600080fd5b50603f80601d6000396000f3fe";
  const { rawTx, txHash } = await builder.buildAndSign(bytecode, "");
  console.log(`  to: (empty → deploy)`);
  console.log(`  tx hash: ${txHash}`);
  const result = await builder.rpc.sendRawTransaction(rawTx);
  console.log(`  RPC: ${JSON.stringify(result)}`);
  return result;
}

// ============================================================================
// 注册表 & 入口
// ============================================================================

const TEST_REGISTRY = {
  transaction:     ["HandleTransaction",      testTransaction],
  stake:           ["HandleStake",            testStake],
  unstake:         ["HandleUnstake",          testUnstake],
  delegating:      ["handleDelegating",       testDelegating],
  undelegating:    ["HandleUndelegating",     testUndelegating],
  bonus:           ["HandleBonus",            testBonus],
  lock:            ["HandleLock",             testLock],
  unlock:          ["HandleUnLock",           testUnlock],
  vote:            ["HandleVote",             testVote],
  proposal:        ["HandleProposal",         testProposal],
  revoke_proposal: ["revokeProposalRequest",  testRevokeProposal],
  treasury:        ["HandleTresury",          testTreasury],
  deploy:          ["DeployContract",         testDeployContract],
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--list" || a === "-l") { opts.list = true; continue; }
    if (a === "--type" || a === "-t") { opts.type = args[++i]; continue; }
    if (a === "--rpc-url") { opts.rpcUrl = args[++i]; continue; }
    if (a === "--chain-id") { opts.chainId = parseInt(args[++i]); continue; }
    if (a === "--private-key") { opts.privateKey = args[++i]; continue; }
    if (a === "--from") { opts.fromAddr = args[++i]; continue; }
    if (a === "--to") { opts.toAddr = args[++i]; continue; }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();

  if (opts.list) {
    console.log("\n可用的测试类型:");
    console.log("-".repeat(45));
    for (const [key, [name]] of Object.entries(TEST_REGISTRY)) {
      console.log(`  ${key.padEnd(20)} → ${name}`);
    }
    console.log();
    return;
  }

  const config = { ...CONFIG };
  if (opts.rpcUrl) config.rpcUrl = opts.rpcUrl;
  if (opts.chainId) config.chainId = opts.chainId;
  if (opts.privateKey) config.privateKey = opts.privateKey;
  if (opts.fromAddr) config.fromAddress = opts.fromAddr;
  if (opts.toAddr) config.toAddress = opts.toAddr;

  if (config.privateKey === "0xYOUR_PRIVATE_KEY") {
    console.error("\n❌ 请设置 --private-key");
    process.exit(1);
  }

  config.maxFeePerGas = ethers.parseUnits("1", "gwei");
  config.maxPriorityFeePerGas = ethers.parseUnits("0.5", "gwei");

  const builder = new TxBuilder(config);

  console.log(`\n🔗 连接节点: ${config.rpcUrl}`);
  const chainResult = await builder.rpc.call("eth_chainId");
  console.log(`  节点 chainId: ${parseInt(chainResult.result || "0x0", 16)}`);
  console.log(`  from: ${config.fromAddress}`);
  console.log(`  to:   ${config.toAddress}`);

  if (opts.type) {
    const [name, func] = TEST_REGISTRY[opts.type] || [];
    if (!func) { console.error(`未知测试类型: ${opts.type}`); process.exit(1); }
    console.log(`\n🎯 运行: ${name}`);
    await func(builder, config);
  } else {
    console.log("\n🧪 运行全部测试...");
    for (const [key, [name, func]] of Object.entries(TEST_REGISTRY)) {
      try {
        await func(builder, config);
      } catch (e) {
        console.error(`  ❌ ${key}: ${e.message}`);
      }
    }
  }
}

main().catch(console.error);
