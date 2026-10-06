interface ResultPanelProps {
  error: string;
  isRunning: boolean;
  output: string;
  status: string;
}

export function ResultPanel({
  error,
  isRunning,
  output,
  status,
}: ResultPanelProps) {
  return (
    <section className="panel output-panel">
      <div className="panel-heading">
        <h2>Result</h2>
        <span>{isRunning ? 'Running' : status}</span>
      </div>

      {error && <div className="error-box">{error}</div>}

      <pre>{output || 'No result yet.'}</pre>
    </section>
  );
}
