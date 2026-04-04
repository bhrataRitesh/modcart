import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@modcart/core", "@modcart/db", "@modcart/search"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
});
