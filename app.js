// You installed the `dotenv` and `octokit` modules earlier. The `@octokit/webhooks` is a dependency of the `octokit` module, so you don't need to install it separately. The `fs` and `http` dependencies are built-in Node.js modules.
import { App } from "octokit";
import { createNodeMiddleware } from "@octokit/webhooks";
import http from "http";
import fs from "fs";
// import path from 'path';
// const configPath = 'config.json';
// import currentDirectory = __dirname;
// const configPath = path.join(currentDirectory, 'config.json');
// const sessionPath = path.join(currentDirectory, 'session.json');
// import fetch from 'node-fetch';

import {
  createSessionId,
  getAccessToken,
  parseIdentifier,
  getRepo,
  getRepoInfo,
  base64ToMDX
 } from './utils.js';
import env from './env.js';



async function useChatApi(repository, userQuestion) {
  const session_id = createSessionId();
  const payload = createPayload2(repository, userQuestion, session_id);

  if (env.DEBUG_MODE)
    console.log(payload)

  try {
    console.log("fetching now")
    const response = await fetch(`${env.GREPTILE_API_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": "Bearer " + getAccessToken(),
        "X-Github-Token": env.ACCESS_TOKEN,
      },
      body: JSON.stringify(payload),
    })
    console.log("fetching done")
    if (env.DEBUG_MODE) {
      console.log(response)
    }
    const responseJson = await response.json();

    // let buffer = '';
    // const decoder = new TextDecoder();
    // let fullResponse = ""
    // for await (const chunk of response.body) {
    //   const chunkText = decoder.decode(chunk);
    //   buffer += chunkText;
    //   const lines = buffer.split(/\r?\n/);
    //   for (let i = 0; i < lines.length - 1; i++) {
    //     const line = lines[i].trim();
    //     if (line.length > 0) {
    //       try {
    //         const jsonData = JSON.parse(line);
    //         if (jsonData.type == "status") {
    //           if (jsonData.message == '') {
    //             console.log("done")
    //             // console.log(" d :, ", fullResponse)
    //             // appendMessageToPayload(payload, fullResponse);
    //             // process.exit(0)
    //           }
    //           console.log(jsonData.message)
    //           if (jsonData.message == "Started processing request") {
    //             // spinner.start();
    //           }
    //           if (jsonData.message == "Writing response") {
    //             // spinner.succeed('Request processed successfully');
    //           }

    //         }
    //         else {
    //           console.log(jsonData.message)
    //           if (typeof jsonData.message === 'string') {
    //             fullResponse += jsonData.message;
    //           }
    //           // process.stdout.write(jsonData.message)
    //         }

    //       } catch (error) {
    //         if (env.DEBUG_MODE) {
    //           console.error('Error parsing JSON:', error);
    //         }
    //       }
    //     }
    //   }

    //   buffer = lines[lines.length - 1];
    // }
    // console.log(fullResponse)
    return JSON.parse(responseJson.message);
  } catch (error) {
    if (env.DEBUG_MODE) {
      console.error('Error:', error.message);
    }
  }
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

async function handleListingFolders({ octokit, payload }) {
  console.log("payload pusher", payload.pusher.name)
  if (payload.pusher.name == 'greptile-autodoc[bot]') {
    return;
  }
  if(env.DEBUG_MODE)
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

    while (tries < 30) {
      try {
        const repoInfo = await getRepoInfo(repository, remote, branch);
        console.log(repoInfo)
        actualSha = repoInfo.sha;

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
      console.error(`Error reading ${path} error: ${error}`);
    }
  }
  await listFilesInFolder('fern/mdx', repoOwner, repoName);

  // getCommitInfo(payload.commits)

  const commits = JSON.stringify(payload.commits)
  let toAddFiles = []
  console.log(commits)
  // concurrenty requste 
  const filesPromises = filesList.map(async (file) => {
    let prompt = "The following are the most recent commits" + commits + "/n The following is a documentation file " + JSON.stringify(file) + " /n You must check if the content of the file is outdated. You should respond in the following format: {outdated : true || false, updatedContent: string}. the outdated flag should ONLY be set to true if the contents of the file is outdated and needs an update. If the content is outdated, you should provide the updated content in the updatedContent field. If the content is not outdated, you should set the updatedContent field to an empty string."
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
    if (response && response.outdated) {
      toAddFiles.push({ path: file.path, updatedContent: response.updatedContent })
    } else {
      console.log('not outdated')
    }
  })
  await Promise.allSettled(filesPromises)
  console.log(toAddFiles)

  function generateBranchName() {
    const timestamp = new Date().getTime();
    return `docs-${timestamp}`;
  }
  const branchName = generateBranchName();
  const baseBranch = 'main'; // Replace with the base branch of your repository
  // const title = 'Update DIAGRAMS.md content again';
  // const body = 'This pull request updates the content of the file.';
  const title = 'Update documentation';
  const body = 'This pull request updates the content of the file.';
  async function createPullRequest(owner, repo, branchName, baseBranch, toAddFiles, title, body) {
    try {
      // Get the reference of the base branch
      const baseRef = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });
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
        await octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: baseRef.data.object.sha,
        });
      }

      if (toAddFiles.length === 0) {
        console.log('No files to add');
        return;
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
      if (newTreeContent.length === 0) {
        console.log('No new tree content');
        return;
      }
      // Create a new tree with the updated blob
      let newTree = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: baseRef.data.object.sha, // Use the SHA of the base tree
        tree: newTreeContent
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
        ref: `heads/${branchName}`,
        sha: newCommit.data.sha,
        force: true
      });

      if(env.DEBUG_MODE)
        console.log('creating pull request...')

      // Create the pull request
      const pullRequest = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head: branchName,
        base: baseBranch,
      });
      console.log(`Pull request created: ${pullRequest.data.html_url}`);
    } catch (error) {
      console.error(`Error creating pull request: ${error.message}`);
    }
  }

  if (payload.pusher.name != 'greptile-autodoc[bot]') {
    createPullRequest(repoOwner, repoName, branchName, baseBranch, toAddFiles, title, body);
  }
}


// // This reads your `.env` file and adds the variables from that file to the `process.env` object in Node.js.

// // This determines where your server will listen.
// //
// // For local development, your server will listen to port 3000 on `localhost`. When you deploy your app, you will change these values. For more information, see "[Deploy your app](#deploy-your-app)."

// This reads the contents of your private key file.

// This creates a new instance of the Octokit App class.

// const path = 'PATH TO KEY';
// const privateKey = fs.readFileSync(path, 'utf-8');

const app = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_APP_PRIVATE_KEY,
  // privateKey: privateKey,
  webhooks: {
    secret: env.WEBHOOK_SECRET,
  },
});

const middleware = createNodeMiddleware(app.webhooks, { path: env.WEBHOOK_PATH });

app.webhooks.onError((error) => {
  if (error.name === "AggregateError") {
    console.error(`Error processing request: ${error.event}`);
    console.error(error)
    console.log(JSON.toString(error.event))

  } else {
    console.error(error);
  }
});
// app.webhooks.on("push", handleCreatingPullRequest);
app.webhooks.on("push", handleListingFolders); // THIS ONE



// async function callGreptile(repository, heading) {
//   await useChatApi("Write Internal Documentation for the Following Heading: " + heading);
// }

// // This creates a Node.js server that listens for incoming HTTP requests (including webhook payloads from GitHub) on the specified port. When the server receives a request, it executes the `middleware` function that you defined earlier. Once the server is running, it logs messages to the console to indicate that it is listening.
http.createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') { // need health check for aws ecs
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'Healthy' }))
  } else {
    middleware(req, res, async (error) => {
      console.log(error)
      res.statusCode = 404
      res.end('no such location')
    })
  
  }
}).listen(env.PORT, () => {
  console.log(`Server is listening for events at port: ${env.PORT}`);
  // console.log('Press Ctrl + C to quit.')
});
