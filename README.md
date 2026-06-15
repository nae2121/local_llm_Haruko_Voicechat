This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Voice Credit

音声合成には **COEIROINK:蔓歌せら（げんき！）** を使用します。

- COEIROINK: https://coeiroink.com/
- COEIROINK利用規約: https://coeiroink.com/terms
- 蔓歌せら / 音源管理者「さっぱりあんずジャム」利用規約:
  https://sapparianzujamu.wixsite.com/sapparianzu/%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84

`src/Tsuruka_sera-genki/` の音声モデル、音声サンプル、画像はこのリポジトリでは再配布しません。
利用者自身で正規配布元から入手し、COEIROINKへインストールしてください。

COEIROINK音声を使う場合は、COEIROINK本体を起動してローカルAPIを有効にしてください。
Docker版アプリは `http://host.docker.internal:50032`、ホスト上で直接起動する場合は
`http://127.0.0.1:50032` へ接続します。チャット画面の「読み上げ」から
`COEIROINK:蔓歌せら` を選択すると使用できます。

生成音声を公開・配布する場合は、最新のCOEIROINK利用規約と音源提供者の利用規約を確認してください。
批判・攻撃、政治・宗教への勧誘、モデルや音声素材の再配布、機械学習用途など、規約上禁止されている用途には使用しないでください。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


