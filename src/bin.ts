#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { createChainDataTorrent } from ".";
const ARGV = process.argv.slice(1);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function* maybyPrefixs(alias: string) {
  yield `-${alias}=`;
  yield `--${alias}=`;
}

function* maybyPreargs(alias: string) {
  yield `-${alias}`;
  yield `--${alias}`;
}

async function getArg(
  aliasList: string[],
  readline?: () => string | Promise<string>,
  argv = ARGV
) {
  for (const alias of aliasList) {
    for (const [i, arg] of argv.entries()) {
      for (const prearg of maybyPreargs(alias)) {
        if (arg === prearg) {
          return {
            alias,
            prearg,
            value: argv[i + 1],
          };
        }
      }
      for (const prefix of maybyPrefixs(alias)) {
        if (arg.startsWith(prefix)) {
          return {
            alias,
            prefix,
            value: arg.slice(prefix.length),
          };
        }
      }
    }
  }
  return {
    value: readline && (await readline()),
  };
}

const simpleQuestion = (question: string) =>
  new Promise<string>((resolve) =>
    rl.question(question + "\n> ", (answer) => resolve(answer.trim()))
  );
const filterMapQuestion = async <R = string>(
  question: string,
  opts?: {
    filter?: (answer: string) => boolean;
    map?: (answer: string) => R;
  }
) => {
  do {
    const answer = await simpleQuestion(question);
    if (!opts) {
      return answer as unknown as R;
    }
    if (opts.filter && opts.filter(answer) !== true) {
      continue;
    }
    if (opts.map) {
      return opts.map(answer);
    }
    return answer as unknown as R;
  } while (true);
};

(async () => {
  const checkInputPath = (inputDirname: string) => {
    if (
      !inputDirname ||
      !fs.existsSync(inputDirname) ||
      !fs.statSync(inputDirname).isDirectory()
      //   !fs.readdirSync(inputDirname).find((n) => n.endsWith(".md5sum"))
    ) {
      return askInputPath();
    }
    return inputDirname;
  };
  const askInputPath = async (): Promise<string> => {
    const answer = await simpleQuestion(`请输入包含chainData的文件夹路径参数`);

    const inputDirname = path.resolve(process.cwd(), answer);
    return checkInputPath(inputDirname);
  };

  const inputFolder = await checkInputPath(
    (await getArg(["i", "input", "d", "dir"], askInputPath)).value ||
      process.cwd()
  );

  const d = new Date();
  const defaultFilebasename = `bfchain-pc-chaindata-${(d.getFullYear() - 2000)
    .toString()
    .padStart(2, "0")}${(d.getMonth() + 1).toString().padStart(2, "0")}${d
    .getDate()
    .toString()
    .padStart(2, "0")}.torrent`;
  const defaultFilename = path.join(process.cwd(), defaultFilebasename);

  const completeFilename = (pathname: string) => {
    if (!pathname.endsWith(".torrent")) {
      return path.resolve(process.cwd(), pathname, defaultFilebasename);
    } else {
      return path.resolve(process.cwd(), pathname);
    }
  };

  /**询问路径 */
  const askOutputPath = async (partFilename?: string) => {
    while (!partFilename) {
      partFilename = await simpleQuestion(
        `请输入要输出的 .torrent 的{文件夹} 或者 {文件名}`
      );
      if (!partFilename) {
        partFilename = await askOutputPath();
      }
    }
    const resFilename = completeFilename(partFilename);
    return await checkOutputPath(resFilename, resFilename !== partFilename);
  };
  /**检查路径 */
  const checkOutputPath = async (outputFilename: string, ask = true) => {
    // 覆盖提示
    if (fs.existsSync(outputFilename)) {
      const overwrite = await filterMapQuestion(
        `文件已经存在，确定覆盖 ${outputFilename}？(Y/n)`,
        {
          map: (answer) => answer === "y" || answer === "Y" || answer === "",
        }
      );

      if (overwrite === false) {
        outputFilename = await askOutputPath();
      }
    } else if (ask) {
      outputFilename = await askYorN(outputFilename);
    }
    return outputFilename;
  };
  /**询问写入路径 */
  const askYorN = async (outputFilename: string): Promise<string> => {
    const answer = await simpleQuestion(
      `将文件写入到 ${outputFilename} ?(Y/n/{FILE_PATH})`
    );
    if (answer === "y" || answer === "Y" || answer === "") {
      return checkOutputPath(outputFilename, false);
    }
    if (answer === "n" || answer === "N") {
      return await askOutputPath();
    }
    return askOutputPath(path.resolve(process.cwd(), answer));
  };

  const outputTorrent = await askOutputPath(
    (
      await getArg(["o", "output"], () => askYorN(defaultFilename))
    ).value
  );

  const publicBaseUrl = (
    await getArg(["u", "url", "b", "baseurl"], () =>
      filterMapQuestion(
        `请输入连接的公网路径(http[s]://domain.com/),在这个网页下可以访问到 "${path.relative(
          process.cwd(),
          inputFolder
        )}" 内的文件`,
        {
          filter: (baseUrl) =>
            baseUrl.startsWith("https://") || baseUrl.startsWith("http://"),
        }
      )
    )
  ).value!;

  console.log(
    `chaindata-torrent-creater -url ${JSON.stringify(
      publicBaseUrl
    )} -input ${JSON.stringify(inputFolder)} -output ${JSON.stringify(
      outputTorrent
    )}`
  );

  await createChainDataTorrent(inputFolder, outputTorrent, publicBaseUrl);
  return rl.close();
})().then(() => {
  console.log("生成成功");
}, console.error);
