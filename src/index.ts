import createTorrent from "create-torrent";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8")
);
export function createChainDataTorrent(
  inputFolder: string,
  outputTorrent: string,
  baseUrl: string
) {
  const opts = {
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
    urlList: fs
      .readdirSync(inputFolder)
      .map((name) => new url.URL(name, baseUrl).href),
  };
  console.log(opts);

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
