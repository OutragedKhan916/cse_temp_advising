const base = process.env.BASE_PATH || "";
module.exports = {
  output: "export",
  basePath: base,
  assetPrefix: base || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};
