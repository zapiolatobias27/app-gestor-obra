/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist tries to optionally require 'canvas' in Node — not needed in browser
    config.resolve.alias.canvas = false
    return config
  },
}

export default nextConfig;
