/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // As fontes vêm do Google Fonts direto no navegador. Sem isso, o build
  // tenta baixá-las e quebra em qualquer máquina sem acesso à internet.
  optimizeFonts: false,
};

export default nextConfig;
