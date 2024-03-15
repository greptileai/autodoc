// You installed the `dotenv` and `octokit` modules earlier. The `@octokit/webhooks` is a dependency of the `octokit` module, so you don't need to install it separately. The `fs` and `http` dependencies are built-in Node.js modules.
import dotenv from "dotenv";
import { App, Octokit } from "octokit";
import { createNodeMiddleware } from "@octokit/webhooks";
import fs from 'fs';
import http from "http";
// require("dotenv").config()

// import path from 'path';
// const configPath = 'config.json';
// import currentDirectory = __dirname;
// const configPath = path.join(currentDirectory, 'config.json');
// const sessionPath = path.join(currentDirectory, 'session.json');
import fetch from 'node-fetch';
import { Base64 } from 'js-base64';
import { ByteLengthQueuingStrategy } from "stream/web";
// GitHub credentials
let clientId = '3b18d3e6e037d70908ac';
clientId = 'Iv1.1bfb3337c164d452'
dotenv.config();
// clientId = '42a2bd08980b5a89a820'
let firstTime = true;
const scope = 'read:user user:email';
const githubEndpoint = 'https://github.com/login/device/code';
let access_token = null;
const debugMode = true;
access_token = process.env.ACCESS_TOKEN;
function base64ToMDX(base64Content) {
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
function isUrlFormat(repository) {
  const urlRegex = /^(https?:\/\/)?([^\/]+)\/([^\/]+)\/([^\/]+)\/?$/;
  return urlRegex.test(repository);
}

async function executeAddCommand(repositoryLink) {

  console.log(repositoryLink)
  const parsedRepo = parseIdentifier(repositoryLink)
  console.log(typeof parsedRepo)
  console.log(parsedRepo)
  let repository, remote, branch;
  try {
    repository = parsedRepo.repository;
    remote = parsedRepo.remote;
    branch = parsedRepo.branch
  }
  catch (error) {
    console.log(error)
    console.log("There was an error processing the repository link. Please check your repository link again")
    process.exit(-1)
  }
  if (typeof repository === 'undefined') {
    console.log("Error: Invalid repository name. Enter github link, e.g. https://github.com/facebook/react")
    process.exit(-1)
  }
  const processRepo = await getRepo(repository);
  const repoInfo = await getRepoInfo(repository, remote, branch);

  try {
    if (debugMode) {
      console.log(repoInfo)
    }

    if (repoInfo.responses[0]) {
      //pass
    }
    else {
      // Check whether this is supposed to be here
      if (repoInfo.failed[0] && repoInfo.failed[0].repository == repository) {
        if (repoInfo.failed[0].statusCode === 400) {
          console.log(`Error ${repoInfo.failed[0].statusCode}: Bad Request`);
        } else if (repoInfo.failed[0].statusCode === 401) {
          console.log(`Error ${repoInfo.failed[0].statusCode}: Unauthorized`);
        } else if (repoInfo.failed[0].statusCode === 404) {
          if (repoInfo.failed[0].message && repoInfo.failed[0].message == "Repository not processed by Onboard.") {
            // writeRepoToFile(repositoryLink);
            const processRepo = await getRepo(repository);
            if (debugMode) {
              console.log(processRepo)
            }
          }
          else {
            console.log(`Error ${repoInfo.failed[0].statusCode}: Not Found`);
          }
        } else if (repoInfo.failed[0].statusCode === 500) {
          console.log(`Error ${repoInfo.failed[0].statusCode}: Internal Server Error`);
        } else {
          console.log(`Error ${repoInfo.failed[0].statusCode}: Unhandled Status Code`);
        }
        process.exit(1)
      }
      await getRepo(repository);
    }
  } catch (error) {
    if (debugMode) { console.error(error) }
    if (repoInfo.failed[0] && repoInfo.failed[0].repository == repository) {
      if (repoInfo.failed[0].statusCode === 400) {
        console.log(`Error ${repoInfo.failed[0].statusCode}: Bad Request`);
      } else if (repoInfo.failed[0].statusCode === 401) {
        console.log(`Error ${repoInfo.failed[0].statusCode}: Unauthorized`);
      } else if (repoInfo.failed[0].statusCode === 404) {
        if (repoInfo.failed[0].message && repoInfo.failed[0].message == "Repository not processed by Onboard.") {
          // writeRepoToFile(repositoryLink);
          const processRepo = await getRepo(repository);
          if (debugMode) { console.log(processRepo) }
        }
        else {
          console.log(`Error ${repoInfo.failed[0].statusCode}: Not Found`);
        }
      } else if (repoInfo.failed[0].statusCode === 500) {
        console.log(`Error ${repoInfo.failed[0].statusCode}: Internal Server Error`);
      } else {
        console.log(`Error ${repoInfo.failed[0].statusCode}: Unhandled Status Code`);
      }
      process.exit(1)
    }
  }
  // console.log(response)
  // Write the updated session data back to the file
}

function writeRepoToFile(repositoryLink) {
  let sessionData;
  try {
    const sessionFile = fs.readFileSync(sessionPath, 'utf-8');
    sessionData = JSON.parse(sessionFile);
  } catch (error) {
    // If the file doesn't exist or has invalid JSON, start with an empty session
    sessionData = {
      repositories: []
    };
  }

  // Check if the repository link already exists
  if (!sessionData.repositories.includes(repositoryLink)) {
    try {
      sessionData.repositories.push(repositoryLink);
      const sessionFile = JSON.stringify(sessionData, null, 2);
      fs.writeFileSync(sessionPath, sessionFile, 'utf-8');
      console.log(`Repository '${repositoryLink}' added to the session.`);
    } catch (error) {
      console.error('Error writing session data to file:', error);
    }
  } else {
    console.log(`Repository '${repositoryLink}' already exists in the session.`);
  }
}

async function getRepo(repo, branch = "main", remote = "github") {
  try {
    const body = JSON.stringify({
      "remote": remote, // one of "github", "gitlab" for now
      "repository": repo, // formatted as owner/repository
      // "branch": "main", // optional, defaults to repo default on GH/GL
      // "reload": true, // optional, if false will not reprocess if previously successful, default true
      // "notify": true // optional, whether to notify the user when finished, default true
    })
    const repoInfo = await fetch(`https://dprnu1tro5.execute-api.us-east-1.amazonaws.com/prod/v1/repositories`, {
      method: "POST",
      body: body,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getAccessToken()
      },
    });

    const repoInfoJson = await repoInfo.json();
    return repoInfoJson;
  } catch (error) {
    if (debugMode) {
      console.log("Error:", error);
    }
    return null;
  }
}

async function getRepoInfo(repo, remote, branch) {
  const repoInfo = await fetch('https://dprnu1tro5.execute-api.us-east-1.amazonaws.com/prod/v1/repositories/batch?repositories=' + getBase64(remote, repo, branch), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + getAccessToken()
    },
  });

  const repoInfoJson = await repoInfo.json();

  return repoInfoJson;
}

async function useChatApi(repository, userQuestion) {
  const session_id = createSessionId();
  const payload = createPayload2(repository, userQuestion, session_id);

  if (debugMode) {
    // console.log(payload)
  }

  let newApiUrl = 'https://y32rqryql6ccw5nqa6qvr7bfbi0tmxuc.lambda-url.us-east-1.on.aws/'

  try {
    console.log("fetching now")
    const response = await fetch(newApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": "Bearer " + getAccessToken()
      },
      body: JSON.stringify(payload),

    })
    console.log("fetching done")
    if (debugMode) {
      console.log(response)
    }
    let buffer = '';
    const decoder = new TextDecoder();
    let fullResponse = ""
    for await (const chunk of response.body) {
      const chunkText = decoder.decode(chunk);
      buffer += chunkText;
      const lines = buffer.split(/\r?\n/);
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line.length > 0) {
          try {
            const jsonData = JSON.parse(line);
            if (jsonData.type == "status") {
              if (jsonData.message == '') {
                console.log("done")
                // console.log(" d :, ", fullResponse)
                // appendMessageToPayload(payload, fullResponse);
                // process.exit(0)
              }
              console.log(jsonData.message)
              if (jsonData.message == "Started processing request") {
                // spinner.start();
              }
              if (jsonData.message == "Writing response") {
                // spinner.succeed('Request processed successfully');
              }

            }
            else {
              console.log(jsonData.message)
              if (typeof jsonData.message === 'string') {
                fullResponse += jsonData.message;
              }
              // process.stdout.write(jsonData.message)
            }

          } catch (error) {
            if (debugMode) {
              console.error('Error parsing JSON:', error);
            }
          }
        }
      }

      buffer = lines[lines.length - 1];
    }
    // console.log(fullResponse)
    return fullResponse;
  } catch (error) {
    if (debugMode) {
      console.error('Error:', error.message);
    }
  }
}

function isAuthenticated() {
  try {
    const configFile = fs.readFileSync(configPath, 'utf-8');
    const configFileData = JSON.parse(configFile)

    if (configFileData.github.access_token != null) {
      access_token = configFileData.github.access_token
      return true;
    }
    else {
      return false;
    }
  } catch (error) {
    if (debugMode) {
      console.log(error)
    }
    return {};
  }
}

function getAccessToken() {
  return access_token;
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
  //   if (debugMode) {
  //     console.log(error)
  //   }
  //   return {};
  // }
}

function getBase64(remote, repository, branch) {
  let repo = remote + ":" + repository + ":" + branch;
  if (debugMode) {
    console.log(repo)
  }
  return (Base64.encode(repo))
}

function createSessionId() {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

function createPayload2(repo, payloadContent, session_id, external = false) {
  const parsedRepo = parseIdentifier(repo);

  const payload = {
    messages: [
      {
        id: '1',
        role: "user",
        content: payloadContent
      }
    ],
    repositories: [
      {
        remote: parsedRepo.remote,
        repository: parsedRepo.repository,
        branch: parsedRepo.branch,
        name: parsedRepo.repository,
        external: external,
      }
    ],
    sessionId: session_id,
    jsonMode: true
  };

  return payload;
}

function parseIdentifier(input) {
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
        repository = repository_list.join("/");
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
    let repository, branch, regex, match;
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
        const org = url.hostname.split(".")[0];
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

function serializeRepoKey(repoKey) {
  const { remote, branch, repository } = repoKey;
  return `${remote}:${branch}:${repository}`;
}
// This reads your `.env` file and adds the variables from that file to the `process.env` object in Node.js.


// This assigns the values of your environment variables to local variables.
const appId = process.env.APP_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;
const privateKeyPath = process.env.PRIVATE_KEY_PATH;

// This reads the contents of your private key file.
const privateKey = fs.readFileSync(privateKeyPath, "utf8");

// This creates a new instance of the Octokit App class.
const app = new App({
  appId: appId,
  privateKey: privateKey,
  webhooks: {
    secret: webhookSecret
  },
});

app.webhooks.onError((error) => {
  if (error.name === "AggregateError") {
    console.error(`Error processing request: ${error.event}`);
    console.error(error)
    console.log(JSON.toString(error.event))

  } else {
    console.error(error);
  }
});

// This determines where your server will listen.
//
// For local development, your server will listen to port 3000 on `localhost`. When you deploy your app, you will change these values. For more information, see "[Deploy your app](#deploy-your-app)."
const port = 3000;
const host = 'localhost';
const path = "/webhook";
const localWebhookUrl = `http://${host}:${port}${path}`;



const middleware = createNodeMiddleware(app.webhooks, { path });
// const octokit = new Octokit();

async function handleListingFolders({ octokit, payload }) {
  if (payload.pusher.name == 'new-docwriter-app[bot]') {
    return;
  }
  console.log(payload)
  const parsedRepo = parseIdentifier(payload.repository.html_url)

  console.log(typeof parsedRepo)
  console.log(parsedRepo)
  let repository, remote, branch;

  repository = parsedRepo.repository;
  remote = parsedRepo.remote;
  branch = parsedRepo.branch
  let targetSha = payload.after;

  console.log(repository, remote, branch)
  const getRepoInfoResponse = await getRepo(repository, branch, remote);
  console.log(getRepoInfoResponse)

  async function checkShaEquality(repository, branch, remote, targetSha) {
    let tries = 0;
    let actualSha = null;

    while (tries < 10) {
      try {
        const repoInfo = await getRepoInfo(repository, remote, branch);
        console.log(repoInfo)
        actualSha = repoInfo.responses[0].sha;

        if (actualSha === targetSha) {
          console.log("Sha equality achieved.");
          return; // Exit the loop
        }

        console.log(`Actual SHA: ${actualSha}, Target SHA: ${targetSha}`);
      } catch (error) {
        console.error("Error occurred while fetching repository information:", error);
      }

      tries++;
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 1 minute
    }

    console.error("Failed to achieve SHA equality after 10 tries.");
  }

  // Usage


  await checkShaEquality(repository, branch, remote, targetSha);


  // console.log(repoInfo)
  const repositoryUrl = payload.repository.html_url;
  const repoOwner = payload.repository.owner.name;
  const repoName = payload.repository.name;
  // console.log(repoOwner, repoName)
  const filesList = []


  // await executeAddCommand(repositoryUrl);

  async function listFilesInFolder(path, repoOwner, repoName) {
    try {
      const result = await octokit.rest.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: path,
      });
      console.log(path)
      await Promise.all(result.data.map(async (item) => {
        if (item.type === 'file' && item.name.endsWith('.mdx')) {
          // console.log(item.path);
          console.log("file", item.path)
          // console.log(item)
          let fileContent = await octokit.rest.repos.getContent({
            owner: repoOwner,
            repo: repoName,
            path: item.path,
          });
          // console.log(fileContent)
          fileContent = (base64ToMDX(fileContent.data.content))
          filesList.push({ "path": item.path, "content": fileContent });


        } else if (item.type === 'dir' && !item.path.startsWith('docs/node_modules')) {
          console.log("dir", item.path)
          await new Promise(r => setTimeout(r, 1000));
          await listFilesInFolder(item.path, repoOwner, repoName);
        }
        return Promise.resolve();
      }));
    } catch (error) {
      console.error(`Error reading ${path} folder: ${error}`);
    }
  }
  await listFilesInFolder('fern/mdx', repoOwner, repoName);

  async function getCommitInfo(commits) {
    // Log information about each commit
    commits.forEach((commit) => {
      console.log(`Commit by ${commit.author.name} (${commit.author.email}):`);
      console.log(`  Message: ${commit.message}`);
      console.log(`  SHA: ${commit.id}`);
      console.log(`  Timestamp: ${commit.timestamp}`);

      // Log details about file changes in the commit
      console.log("  Changes:");
      commit.added.forEach((addedFile) => {
        console.log(`    Added: ${addedFile}`);
      });
      commit.modified.forEach((modifiedFile) => {
        console.log(`    Modified: ${modifiedFile}`);
      });
      commit.removed.forEach((removedFile) => {
        console.log(`    Removed: ${removedFile}`);
      });

      console.log("---");
    });
  }

  // getCommitInfo(payload.commits)

  const commits = JSON.stringify(payload.commits)
  let toAddFiles = []
  // console.log(commits)
  for (const file of filesList) {
    let prompt = "The following are the most recent commits" + commits + "/n The following is a documentation file " + JSON.stringify(file) + " /n You must check if the content of the file is outdated. You should respond in teh following format: {outdated : true || false, updatedContent: string}. The updatedContent should only be filled if outdated is set to true"
    // console.log(prompt)
    let response = await useChatApi(repositoryUrl, prompt);
    console.log(typeof response)
    console.log(response)
    // response = JSON.parse(response)
    // console.log(typeof response)
    // var keys = Object.keys(response);
    // keys.forEach(function (key) {
    //   console.log(key);
    // });
    if (response.outdated == false) {
      console.log("he")
    }
    else {
      toAddFiles.push({ path: file.path, updatedContent: response.updatedContent })
    }

  }
  console.log(toAddFiles)

  function generateBranchName() {
    const timestamp = new Date().getTime();
    return `docs-${timestamp}`;
  }
  const branchName = generateBranchName();
  const baseBranch = 'main'; // Replace with the base branch of your repository
  const title = 'Update DIAGRAMS.md content again';
  const body = 'This pull request updates the content of the file.';
  async function createPullRequest(owner, repo, branchName, baseBranch, toAddFiles, title, body) {
    try {
      // Get the reference of the base branch
      const baseRef = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });

      let newBranchRef;
      try {
        await octokit.rest.repos.getBranch({
          owner,
          repo,
          branch: branchName,
        });
        // const newBranchRef = await octokit.rest.git.updateRef({
        //   owner,
        //   repo,
        //   ref: `heads/${branchName}`,
        //   sha: baseRef.data.object.sha,
        // });
      }
      catch (error) {
        console.log(error)
        const newBranchRef = await octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: baseRef.data.object.sha,
        });
      }

      let newTreeContent = []
      toAddFiles.forEach(async (file) => {
        let newBlob = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.updatedContent).toString('base64'),
          encoding: 'base64',
        });
        newTreeContent.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: newBlob.data.sha,
        })
      })
      // Create a new tree with the updated blob
      let newTree = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: baseRef.data.object.sha, // Use the SHA of the base tree
        tree: newTreeContent
        // tree: [{
        //   path: filePath,
        //   mode: '100644',
        //   type: 'blob',
        //   sha: newBlob.data.sha,
        // }],
      });

      // Create a new commit with the updated tree
      const newCommit = await octokit.rest.git.createCommit({
        owner,
        repo,
        message: title,
        tree: newTree.data.sha,
        parents: [baseRef.data.object.sha],
      });

      // Update the reference of the new branch to the new commit
      await octokit.rest.git.updateRef({
        owner,
        repo,
        // ref: newBranchRef.data.ref.replace('ref/', ''),
        ref: 'heads/random-2',
        sha: newCommit.data.sha,
        force: true
      });

      // Create the pull request
      const pullRequest = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head: branchName,
        base: baseBranch,
      });

      console.log("e")
      console.log(`Pull request created: ${pullRequest.data.html_url}`);
    } catch (error) {
      console.error(`Error creating pull request: ${error.message}`);
    }
  }

  if (payload.pusher.name != 'new-docwriter-app[bot]') {
    createPullRequest(repoOwner, repoName, branchName, baseBranch, toAddFiles, title, body);
  }

}

async function handleCreatingPullRequest({ octokit, payload }) {

  async function createPullRequest(owner, repo, branchName, baseBranch, toAddFiles, title, body) {
    try {
      // Get the reference of the base branch
      const baseRef = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });

      let newBranchRef;
      try {
        await octokit.rest.repos.getBranch({
          owner,
          repo,
          branch: branchName,
        });
        // const newBranchRef = await octokit.rest.git.updateRef({
        //   owner,
        //   repo,
        //   ref: `heads/${branchName}`,
        //   sha: baseRef.data.object.sha,
        // });
      }
      catch (error) {
        console.log(error)
        const newBranchRef = await octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: baseRef.data.object.sha,
        });
      }

      // const existingFile = await octokit.rest.repos.getContent({
      //   owner,
      //   repo,
      //   path: filePath,
      //   ref: baseBranch,
      // });

      // Encode the content of the file
      const content = Buffer.from(existingFile.data.content, 'base64').toString('utf-8');

      // Make the desired changes to the file content
      changes(content);

      // Create a new blob with the updated content
      const newBlob = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: Buffer.from(content).toString('base64'),
        encoding: 'base64',
      });

      let newTreeContent = []
      toAddFiles.forEach(async (file) => {
        let newBlob = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.updatedContent).toString('base64'),
          encoding: 'base64',
        });
        newTreeContent.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: newBlob.data.sha,
        })
      })
      // Create a new tree with the updated blob
      let newTree = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: baseRef.data.object.sha, // Use the SHA of the base tree
        tree: newTreeContent
        // tree: [{
        //   path: filePath,
        //   mode: '100644',
        //   type: 'blob',
        //   sha: newBlob.data.sha,
        // }],
      });

      // Create a new commit with the updated tree
      const newCommit = await octokit.rest.git.createCommit({
        owner,
        repo,
        message: title,
        tree: newTree.data.sha,
        parents: [baseRef.data.object.sha],
      });

      // Update the reference of the new branch to the new commit
      await octokit.rest.git.updateRef({
        owner,
        repo,
        // ref: newBranchRef.data.ref.replace('ref/', ''),
        ref: 'heads/random-2',
        sha: newCommit.data.sha,
        force: true
      });

      // Create the pull request
      const pullRequest = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head: branchName,
        base: baseBranch,
      });

      console.log("e")
      // console.log(`Pull request created: ${pullRequest.data.html_url}`);
    } catch (error) {
      console.error(`Error creating pull request: ${error.message}`);
    }
  }



  const repoOwner = 'dhruv317'; // GitHub username or organization name
  const repoName = 'helicone'; // Name of your GitHub repository
  function generateBranchName() {
    const timestamp = new Date().getTime();
    return `docs-${timestamp}`;
  }
  const branchName = generateBranchName();
  const baseBranch = 'main'; // Replace with the base branch of your repository
  const filePath = 'DIAGRAMS.md'; // Replace with the path to the file you want to modify
  const title = 'Update DIAGRAMS.md content again';
  const body = 'This pull request updates the content of the file.';

  // Call the function to create a pull request
  if (payload.pusher.name != 'new-docwriter-app[bot]') {
    createPullRequest(repoOwner, repoName, branchName, baseBranch, toAddFiles, title, body);
  }
}
// app.webhooks.on("push", handleCreatingPullRequest);
app.webhooks.on("push", handleListingFolders);

// async function callGreptile(repository, heading) {

//   await useChatApi("Write Internal Documentation for the Following Heading: " + heading);
// }
// This creates a Node.js server that listens for incoming HTTP requests (including webhook payloads from GitHub) on the specified port. When the server receives a request, it executes the `middleware` function that you defined earlier. Once the server is running, it logs messages to the console to indicate that it is listening.
http.createServer(middleware).listen(port, () => {
  console.log(`Server is listening for events at: ${localWebhookUrl}`);
  console.log('Press Ctrl + C to quit.')
});

