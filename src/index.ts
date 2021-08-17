import createTorrent from "create-torrent";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8")
);
export async function createChainDataTorrent(
  inputFolder: string,
  outputTorrent: string,
  baseUrl: string
) {
  const baseUrlInfo = new URL(baseUrl);
  const baseUrlPathnames = baseUrlInfo.pathname.split("/").filter(Boolean);

  if (baseUrlPathnames.length === 0) {
    throw new Error(`no found {FOLDER_NAME} in baseUrl`);
  }
  const name = baseUrlPathnames.pop();
  baseUrl = new URL(baseUrlPathnames.join("/") + "/", baseUrlInfo.origin).href;

  const opts = {
    name: name,
    comment: "BFChain ChainData v1",
    createdBy: `${pkg.name}@${pkg.version}`,
    pieceLength: 1024 * 1024 * 2,
    announceList: [
      [
        "http://p2ptracker.bfchain.com/announce",
        "udp://p2ptracker.bfchain.com",
        "ws://p2ptracker.bfchain.com",
      ],
    ],
    urlList: [baseUrl],
  };
  const checkUrl = new URL(
    name + "/" + fs.readdirSync(inputFolder).shift()!,
    baseUrl
  ).href;
  console.log(opts);
  await new Promise<void>((resolve, reject) => {
    http.get(checkUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`请确保${checkUrl}是可访问的`));
      } else {
        resolve();
      }
    });
  });

  return new Promise<void>((resolve, reject) => {
    createTorrent(inputFolder, opts, (err, torrent) => {
      if (err) {
        // `torrent` is a Buffer with the contents of the new .torrent file
        return reject(err);
      }
      fs.writeFileSync(outputTorrent, torrent);
      resolve();
    });
  });
}
