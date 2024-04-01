import { Base64 } from 'js-base64';

import env from './env.js';

export function base64ToMDX(base64Content) {
  try {
    // Step 1: Decode base64
    const decodedContent = atob(base64Content);

    // Step 2: Use the decoded content as MDX
    // console.log("Decoded Content:", decodedContent);

    // You can further process the decoded content or return it as is
    return decodedContent;
  } catch (error) {
    console.error('Error decoding base64:', error);
    return null;
  }
}

export async function getRepo(repo, branch = "main", remote = "github") {
  try {
    const body = JSON.stringify({
      "remote": remote, // one of "github", "gitlab" for now
      "repository": repo, // formatted as owner/repository
      "branch": branch, // optional, defaults to repo default on GH/GL
      // "reload": true, // optional, if false will not reprocess if previously successful, default true
      // "notify": true // optional, whether to notify the user when finished, default true
    })
    const repoInfo = await fetch(`${env.GREPTILE_API_URL}/repositories`, {
      method: "POST",
      body: body,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getAccessToken(),
        "X-Github-Token": env.ACCESS_TOKEN, 
      },
    });

    const repoInfoJson = await repoInfo.json();
    return repoInfoJson;
  } catch (error) {
    if (env.DEBUG_MODE) {
      console.log("Error:", error);
    }
    return null;
  }
}

export async function getRepoInfo(repo, remote, branch) {
  const repoInfo = await fetch(`${env.GREPTILE_API_URL}/repositories/${encodeURIComponent(`${remote}:${branch}:${repo}`)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + getAccessToken(),
      "X-Github-Token": env.ACCESS_TOKEN,
    },
  });

  const repoInfoJson = await repoInfo.json();

  return repoInfoJson;
}

export function parseIdentifier(input) {
  console.log(input)
  if (!isDomain(input)) {
    const regex = /^(([^:]*):([^:]*):|[^:]*)([^:]*)$/;
    const match = input.match(regex);
    if (!match) return null;
    const keys = input.split(":");
    if (keys.length === 1)
      return serializeRepoKey({
        remote: "github",
        branch: "",
        repository: keys[0],
      });
    if (keys.length === 3) {
      let remote = keys[0],
        branch = keys[1],
        repository = keys[2];
      if (remote === "azure" && repository.split("/").length == 2) {
        let repository_list = repository.split("/");
        repository_list.push(repository_list[1]);
        repository = repositoryA_list.join("/");
      }
      return serializeRepoKey({
        remote: remote,
        branch: branch,
        repository: repository,
      });
    }
    return null; // only 2 entries may be ambiguous (1 might be as well...)
  }
  if (!input.startsWith("http")) input = "https://" + input;
  if (input.endsWith(".git")) input = input.slice(0, -4);
  try {
    const url = new URL(input);
    let remote = (() => {
      try {
        const services = ["github", "gitlab", "bitbucket", "azure", "visualstudio"];
        return (services.find((service) => url.hostname.includes(service)) || null)
      } catch (e) {
        return null;
      }
    })();
    if (!remote) return null;
    let repository, branch, regex, match, org;
    switch (remote) {
      case "github":
        regex =
          /([a-zA-Z0-9\._-]+\/[a-zA-Z0-9\%\._-]+)[\/tree\/]*([a-zA-Z0-0\._-]+)?/;
        match = url.pathname.match(regex);
        repository = decodeURIComponent(match?.[1] || "");
        branch = match?.[2];
        break;
      case "gitlab":
        regex =
          /([a-zA-Z0-9\._-]+\/[a-zA-Z0-9\%\._-]+)(?:\/\-)?(?:(?:\/tree\/)([a-zA-Z0-0\._-]+))?/;
        match = url.pathname.match(regex);
        repository = decodeURIComponent(match?.[1] || "");
        branch = match?.[2];
        break;

      case "azure":
        regex = /([a-zA-Z0-9\%\.\/_-]+)/;
        match = url.pathname.match(regex);
        repository =
          match?.[1].split("/").filter((x) => x !== "_git" && x !== "") || [];
        repository.push(repository?.slice(-1)[0]);
        repository = decodeURIComponent(repository.slice(0, 3).join("/"));
        branch = url.searchParams.get("version")?.slice(2); // remove 'GB' from the beginning
        break;
      case "visualstudio":
        remote = "azure"
        regex = /([a-zA-Z0-9\%\.\/_-]+)/;
        org = url.hostname.split(".")[0];
        match = url.pathname.match(regex);
        repository =
          match?.[1].split("/").filter((x) => x !== "_git" && x !== "") || [];
        repository = decodeURIComponent([org, ...(repository.slice(0, 2))].join("/"));
        branch = url.searchParams.get("version")?.slice(2); // remove 'GB' from the beginning
        break;
      default:
        return url.hostname;
    }
    if (!repository) return null;
    // console.log(remote,branch,repository)
    if (typeof branch === "undefined") {
      branch = "main";
    }
    return { remote, branch, repository };
    // return serializeRepoKey({
    //   remote: remote,
    //   branch: branch || "main",
    //   repository: repository,
    // });
  } catch (e) {
    return null;
  }
};

export function getAccessToken() {
  return env.GREPTILE_API_KEY
  // try {
  //   const configFile = fs.readFileSync(configPath, 'utf-8');
  //   const configFileData = JSON.parse(configFile)

  //   if (configFileData.github.access_token != null) {
  //     access_token = configFileData.github.access_token
  //     return access_token;
  //   }
  //   else {
  //     return null;
  //   }
  // } catch (error) {
  //   if (env.DEBUG_MODE) {
  //     console.log(error)
  //   }
  //   return {};
  // }
}

export function createSessionId() {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

function getBase64(remote, repository, branch) {
  let repo = remote + ":" + repository + ":" + branch;
  if (env.DEBUG_MODE) {
    console.log(repo)
  }
  return (Base64.encode(repo))
}

function serializeRepoKey(repoKey) {
  const { remote, branch, repository } = repoKey;
  return `${remote}:${branch}:${repository}`;
}

function isDomain(input) {
  try {
    new URL(input);
    const regex = /^(([^:]*):([^:]*):|[^:]*)([^:]*)$/;
    const match = input.match(regex);
    if (match) return false;
    return true;
  } catch (e) {
    return false;
  }
}