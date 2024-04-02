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
//test

import {
  parseIdentifier,
  getRepo,
  getRepoInfo,
  getToken,
  base64ToMDX,
  useChatApi
} from './utils.js';
import logger from './logger.js';
import env from './env.js';

async function handleListingFolders({ octokit, payload }) {
  // console.log("payload pusher", payload.pusher.name)
  logger.info("payload pusher", payload.pusher.name)
  if (payload.pusher.name == 'greptile-autodoc[bot]') {
    return;
  }
  if (env.DEBUG_MODE)
    logger.info('payload', { payload })
    // console.log(payload)
  const parsedRepo = parseIdentifier(payload.repository.html_url)

  const repositoryUrl = payload.repository.html_url;
  const repoOwner = payload.repository.owner.name;
  const repoName = payload.repository.name;
  const baseBranch = payload.repository.default_branch;

  function getDocMetadata(repoOwner, repoName) {
    try {
      // Read the JSON file
      const jsonData = fs.readFileSync(env.USERS_JSON_FILE, 'utf8');
      const docArray = JSON.parse(jsonData);
      // Construct the key to search for
      const repoKey = `${repoOwner}/${repoName}`;

      // Search for the repository in the docArray
      for (const doc of docArray) {
        if (repoKey in doc) {
          return doc[repoKey];
        }
      }

      // If repository not found, throw an error
      throw new Error(`Repository ${repoKey} not found in the JSON file.`);
    } catch (error) {
      console.error('Error:', error.message);
      throw error;
    }
  }
  const {
    docFolder,
    ownerEmail,
  } = getDocMetadata(repoOwner, repoName);

  const token = await getToken(ownerEmail);

  // console.log(parsedRepo)
  logger.info("parsedRepo", { parsedRepo })
  let repository, remote, branch;

  repository = parsedRepo.repository;
  remote = parsedRepo.remote;
  branch = parsedRepo.branch
  let targetSha = payload.after;
  const getRepoInfoResponse = await getRepo(repository, branch, remote, token);
  // console.log('getRepoInfoResponse:', getRepoInfoResponse)
  logger.info("getRepoInfoResponse", { getRepoInfoResponse })

  async function checkShaEquality(repository, branch, remote, targetSha, token) {
    let tries = 0;
    let actualSha = null;
    // TODO fix this to actually wait properly
    while (tries < 30) {
      try {
        const repoInfo = await getRepoInfo(repository, remote, branch, token);
        // console.log(repoInfo)
        logger.info("repoInfo", { repoInfo })
        actualSha = repoInfo.sha;

        if (actualSha === targetSha) {
          // console.log("Sha equality achieved.");
          logger.info("Sha equality achieved.")
          return; // Exit the loop
        }

        // console.log(`Actual SHA: ${actualSha}, Target SHA: ${targetSha}`);
        logger.info(`Actual SHA: ${actualSha}, Target SHA: ${targetSha}`);
      } catch (error) {
        // console.error("Error occurred while fetching repository information:", error);
        logger.error("Error occurred while fetching repository information:", error);
      }

      tries++;
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 1 minute
    }

    // console.error("Failed to achieve SHA equality after 10 tries.");
    logger.error("Failed to achieve SHA equality after 30 tries.");
  }

  // Usage
  await checkShaEquality(repository, branch, remote, targetSha, token);

  // console.log(repoOwner, repoName)
  const filesList = []
  // await executeAddCommand(repositoryUrl);

  async function listFilesInFolder(path, repoOwner, repoName) {
    try {
      let result;
      if (path.startsWith('/')) {
        path = path.slice(1); // Remove the leading slash
        result = await octokit.rest.repos.getContent({
          owner: repoOwner,
          repo: repoName,
          path: path,
        });
      } else {
        let [docRepoOwner, docRepoName] = path.split('/');
        result = await octokit.rest.repos.getContent({
          owner: docRepoOwner,
          repo: docRepoName,
          path: '',
        })
      }

      // console.log(path)
      logger.info("path", { path })
      await Promise.all(result.data.map(async (item) => {
        if (item.type === 'file' && item.name.endsWith('.mdx')) {
          // console.log(item.path);
          // console.log("file", item.path)
          logger.info("file", { file: item.path })
          // console.log(item)
          let fileContent = await octokit.rest.repos.getContent({
            owner: repoOwner,
            repo: repoName,
            path: item.path
          });
          // console.log(fileContent)
          fileContent = (base64ToMDX(fileContent.data.content))
          filesList.push({ "path": item.path, "content": fileContent });

        } else if (item.type === 'dir' && !item.path.startsWith('docs/node_modules')) {
          // console.log("dir", item.path)
          logger.info("dir", { dir: item.path })
          await new Promise(r => setTimeout(r, 1000));
          await listFilesInFolder(`/${item.path}`, repoOwner, repoName);
        }
        return Promise.resolve();
      }));
    } catch (error) {
      // console.error(`Error reading ${path} error: ${error}`);
      logger.error(`Error reading ${path} error: ${error}`);
    }
  }

  await listFilesInFolder(docFolder, repoOwner, repoName, ownerEmail);

  // getCommitInfo(payload.commits)

  const commits = JSON.stringify(payload.commits)
  let toAddFiles = []
  // console.log(commits)
  logger.info("commits", { commits })
  // concurrenty requste 
  const filesPromises = filesList.map(async (file) => {
    let prompt = "The following are the most recent commits" + commits + "/n The following is a documentation file " + JSON.stringify(file) + " /n You must check if the content of the file is outdated. You should respond in the following format: {outdated : true || false, updatedContent: string}. the outdated flag should ONLY be set to true if the contents of the file is outdated and needs an update. If the content is outdated, you should provide the updated content in the updatedContent field. If the content is not outdated, you should set the updatedContent field to an empty string."
    // console.log(prompt)
    let response = await useChatApi(repositoryUrl, prompt, token);
    // console.log(typeof response)
    // console.log(response)
    logger.info("response", { response })
    // response = JSON.parse(response)
    // console.log(typeof response)
    // var keys = Object.keys(response);
    // keys.forEach(function (key) {
    //   console.log(key);
    // });
    if (response && response.outdated) {
      toAddFiles.push({ path: file.path, updatedContent: response.updatedContent })
    } else {
      // console.log('not outdated')
      logger.info('not outdated')
    }
  })
  await Promise.allSettled(filesPromises)
  console.log(toAddFiles)

  function generateBranchName() {
    const timestamp = new Date().getTime();
    return `greptile-autodoc-${timestamp}`;
  }
  const branchName = generateBranchName();
  // const title = 'Update DIAGRAMS.md content again';
  // const body = 'This pull request updates the content of the file.';
  const title = '[Greptile Autodoc] Update documentation';
  const body = 'Greptile Autodoc recommends updating the following documentation files. Please review the changes and merge the pull request.';
  async function createPullRequest(owner, repo, branchName, baseBranch, toAddFiles, title, body) {
    try {

      if (toAddFiles.length === 0) {
        // console.log('No files to add');
        logger.info('No files to add')
        return;
      }

      let newTreeContent = []
      let promise = toAddFiles.map(async (file) => {
        let newBlob = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.updatedContent).toString('base64'),
          encoding: 'base64',
        });
        if(env.DEBUG_MODE) 
          logger.info('newBlob', { path: file.path, sha: newBlob.data.sha })
        newTreeContent.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: newBlob.data.sha,
        })
      })

      await Promise.allSettled(promise)
      
      if (newTreeContent.length === 0) {
        logger.info('No new tree content')
        // console.log('No new tree content');
        return;
      }
      // only attempt to create a branch if there are files to add
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
      }
      catch (error) {
        // console.log(error)
        logger.error('error getting branch, creating...', { error })
        await octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: baseRef.data.object.sha,
        });
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

      if (env.DEBUG_MODE)
        logger.info('creating pull request...')
        // console.log('creating pull request...')

      // Create the pull request
      const pullRequest = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head: branchName,
        base: baseBranch,
      });
      logger.info(`Pull request created: ${pullRequest.data.html_url}`)
      // console.log(`Pull request created: ${pullRequest.data.html_url}`);
    } catch (error) {
      logger.error(`Error creating pull request: ${error.message}`);
      // console.error(`Error creating pull request: ${error.message}`);
    }
  }

  if (payload.pusher.name != 'greptile-autodoc[bot]') {
    createPullRequest(repoOwner, repoName, branchName, baseBranch, toAddFiles, title, body);
  }
}

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
    // console.error(`Error processing request: ${error.event}`);
    // console.error(error)
    // console.log(JSON.toString(error.event))
    logger.error(`Error processing request: ${error.event}`);
    logger.error(error)
  } else {
    // console.error(error);
    logger.error('weird error from webhook (toplevel)', error)
  }
});
// app.webhooks.on("push", handleCreatingPullRequest);
app.webhooks.on("push", handleListingFolders); // THIS ONE
// async function callGreptile(repository, heading) {
//   await useChatApi("Write Internal Documentation for the Following Heading: " + heading);
// }

http.createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') { // need health check for aws ecs
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'Healthy' }))
  } else {
    middleware(req, res, async (error) => {
      // console.log(error)
      logger.error('weird error from webhook (middleware)', error)
      res.statusCode = 404
      res.end('no such location')
    })

  }
}).listen(env.PORT, () => {
  console.log(`Server is listening for events at port: ${env.PORT}`);
});
