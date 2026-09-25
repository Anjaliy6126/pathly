export function getHealth(req, res) {
  res.status(200).json({
    status: "ok",
    message: "Pathly server is running",
    timestamp: new Date().toISOString(),
  });
}
