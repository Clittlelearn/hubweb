import { lazy } from "react";
import { createBrowserRouter } from "react-router";

const Layout = lazy(() => import("./layouts/app-layout"));
const Dashboard = lazy(() => import("./pages/dashboard/page"));
const Governance = lazy(() => import("./pages/governance/page"));
const GovernanceProposalDetail = lazy(
  () => import("./pages/governance/governance-proposal-detail-page"),
);
const Flow = lazy(() => import("./pages/flow/page"));
const Bridge = lazy(() => import("./pages/bridge/page"));
const Validators = lazy(() => import("./pages/validators/page"));
const ValidatorDetail = lazy(
  () => import("./pages/validators/validator-detail-page"),
);
const Delegate = lazy(() => import("./pages/delegate/page"));
const LockUnlock = lazy(() => import("./pages/lock/page"));
const Wallet = lazy(() => import("./pages/wallet/page"));
const NativeFlowTest = lazy(() => import("./pages/dev-tools/page"));

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard, handle: { title: "Dashboard" } },
      { path: "wallet", Component: Wallet, handle: { title: "Wallet" } },
      {
        path: "validators",
        Component: Validators,
        handle: { title: "Validators" },
      },
      {
        path: "validators/:validatorId",
        Component: ValidatorDetail,
        handle: { title: "Validator" },
      },
      {
        path: "delegate",
        Component: Delegate,
        handle: { title: "Delegate" },
      },
      { path: "lock", Component: LockUnlock, handle: { title: "Lock" } },
      {
        path: "governance",
        Component: Governance,
        handle: { title: "Governance" },
      },
      {
        path: "governance/:proposalId",
        Component: GovernanceProposalDetail,
        handle: { title: "Proposal Details" },
      },
      { path: "flow", Component: Flow, handle: { title: "Flow" } },
      { path: "bridge", Component: Bridge, handle: { title: "Bridge" } },
      {
        path: "dev-tools/native-flow",
        Component: NativeFlowTest,
        handle: { title: "Native Flow Test" },
      },
    ],
  },
]);
