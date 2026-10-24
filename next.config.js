/** Static export for GitHub Pages. BASE_PATH is set by the workflow (e.g. "/my-repo"); empty locally. */
const base = process.env.BASE_PATH || "";
module.exports = {
  output: "export",
  basePath: base,
  assetPrefix: base || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};
