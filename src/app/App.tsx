import { Suspense } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { WalletProvider } from './providers/wallet-provider';
import { RouteLoadingScreen } from './components/route-loading-screen';
import { AccountAssetProvider } from './providers/account-assets-provider';
import { FeedbackProvider } from './providers/feedback-provider';

export default function App() {
  return (
    <WalletProvider>
      <FeedbackProvider>
        <AccountAssetProvider>
          <Suspense fallback={<RouteLoadingScreen />}>
            <RouterProvider router={router} />
          </Suspense>
        </AccountAssetProvider>
      </FeedbackProvider>
    </WalletProvider>
  );
}
