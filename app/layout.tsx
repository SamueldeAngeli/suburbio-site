import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Subúrbio RP — Da quebrada pro mundo',description:'Sua história começa no Subúrbio. Conheça a cidade, encontre seu caminho e explore a loja oficial.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
