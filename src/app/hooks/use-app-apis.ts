import { ApiService } from '../apis/api-service';
import { RpcApi } from '../apis/rpc-api';
import {
  getNetworkByKey,
  type NetworkKey,
  type WalletNetwork,
} from '../lib/wallet';
import { useWallet } from '../providers/wallet-provider';

export interface AppApis {
  activeNetwork: WalletNetwork;
  rpcApi: string;
  apiService: ApiService;
  rpcService: RpcApi;
}

const appApisCache = new Map<NetworkKey, AppApis>();

function resolveRpcApi(activeNetwork: WalletNetwork) {
  return activeNetwork.service.rpcApi || activeNetwork.rpcs[0] || '';
}

function createAppApis(activeNetwork: WalletNetwork): AppApis {
  const rpcApi = resolveRpcApi(activeNetwork);
  const baseApi = activeNetwork.service.baseApi;
  return {
    activeNetwork,
    rpcApi,
    rpcService: new RpcApi(rpcApi),
    apiService: new ApiService(baseApi, '/api/v1'),
  };
}

export function getAppApis(network: WalletNetwork | NetworkKey): AppApis {
  const activeNetwork =
    typeof network === 'string' ? getNetworkByKey(network) : network;
  const cachedApis = appApisCache.get(activeNetwork.key);

  if (cachedApis) {
    return cachedApis;
  }

  const nextApis = createAppApis(activeNetwork);
  appApisCache.set(activeNetwork.key, nextApis);

  return nextApis;
}

export function useAppApis() {
  const { currentNetwork } = useWallet();

  return getAppApis(currentNetwork);
}

export function useRpcApi() {
  return useAppApis().rpcApi;
}

export function useApiService() {
  return useAppApis().apiService;
}

export function useRpcService() {
  return useAppApis().rpcService;
}
