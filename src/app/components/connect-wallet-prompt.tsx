import { Wallet } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useWallet } from "../providers/wallet-provider";
import { motion } from "motion/react";

interface ConnectWalletPromptProps {
  /** "full" = centered full-page style, "inline" = compact inline card */
  variant?: "full" | "inline";
  message?: string;
}

export function ConnectWalletPrompt({
  variant = "full",
  message = "Connect your wallet to access this feature.",
}: ConnectWalletPromptProps) {
  const { connect, currentNetwork } = useWallet();

  if (variant === "inline") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="p-8 bg-card/80 border-border/50 backdrop-blur-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
            <Wallet className="w-7 h-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold">Wallet Not Connected</h3>
            <p className="text-muted-foreground text-sm">
              {message} Current target: {currentNetwork.label}.
            </p>
          </div>
          <Button
            onClick={connect}
            className="bg-primary hover:bg-primary/90 cursor-pointer"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-[60vh]"
    >
      <Card className="p-12 bg-card/80 border-border/50 backdrop-blur-sm max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
          <Wallet className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            {message} Current target: {currentNetwork.label}.
          </p>
        </div>
        <Button
          onClick={connect}
          className="bg-primary hover:bg-primary/90 h-12 px-8 cursor-pointer"
        >
          <Wallet className="w-5 h-5 mr-2" />
          Connect Wallet
        </Button>
      </Card>
    </motion.div>
  );
}
