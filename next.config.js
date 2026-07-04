/** @type {import('next').NextConfig} */
const nextConfig = {
  // No remote image hosts: all destination imagery is rendered locally by
  // <DestinationMark />. Add remotePatterns back when real photography lands.
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
