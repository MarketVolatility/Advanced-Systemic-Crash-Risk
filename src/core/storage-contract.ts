/** Do not rename these keys: installed browsers and cloud snapshots already use them. */
export function snapshotKeys(owner: string) {
  return {
    entryHistory:'crash-risk-history-v1:'+owner,
    fedWatchHistory:'crash-risk-fed-watch-v1:'+owner,
    fundingHistory:'crash-risk-funding-v1:'+owner,
    fredHistory:'crash-risk-fred-data-v1:'+owner,
    analysisHistory:'crash-risk-analysis-v1:'+owner
  };
}
