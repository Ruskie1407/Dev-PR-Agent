/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/', destination: '/updates', permanent: false },
    ];
  },
};
export default nextConfig;
