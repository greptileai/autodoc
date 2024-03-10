// You installed the `dotenv` and `octokit` modules earlier. The `@octokit/webhooks` is a dependency of the `octokit` module, so you don't need to install it separately. The `fs` and `http` dependencies are built-in Node.js modules.
import dotenv from "dotenv";
import { App, Octokit } from "octokit";
import { createNodeMiddleware } from "@octokit/webhooks";
import fs from "fs";
import http from "http";

// This reads your `.env` file and adds the variables from that file to the `process.env` object in Node.js.
dotenv.config();

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
const repoOwner = "dhruv317";
const repoName = "helicone";
async function handleListingFolders({ octokit, payload }) {
  async function listFilesInFolder(path) {
    try {

      // for await (const { octokit, repository } of app.eachRepository.iterator()) {
      const result = await octokit.rest.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: path,
      });
      console.log(path)
      await Promise.all(result.data.map(async (item) => {
        if (item.type === 'file' && item.name.endsWith('.mdx')) {
          console.log(item.path);
        } else if (item.type === 'dir' && !item.path.startsWith('docs/node_modules')) {

          await new Promise(r => setTimeout(r, 1000));
          await listFilesInFolder(item.path);
        }
      }));

    } catch (error) {
      console.error(`Error reading ${path} folder: ${error.message}`);
    }
  }

  listFilesInFolder('docs');
}

async function handleCreatingPullRequest({ octokit, payload }) {

  async function createPullRequest(owner, repo, branchName, baseBranch, filePath, changes, title, body) {
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

      const existingFile = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: baseBranch,
      });

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

      // Create a new tree with the updated blob
      const newTree = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: baseRef.data.object.sha, // Use the SHA of the base tree
        tree: [{
          path: filePath,
          mode: '100644',
          type: 'blob',
          sha: newBlob.data.sha,
        }],
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
  const changes = (content) => {
    // Make your changes to the file content here
    content += '\n// Add your modifications here';
  };

  // Call the function to create a pull request
  if (payload.pusher.name != 'new-docwriter-app[bot]') {
    createPullRequest(repoOwner, repoName, branchName, baseBranch, filePath, changes, title, body);
  }
}
// app.webhooks.on("push", handleCreatingPullRequest);
app.webhooks.on("push", handleListingFolders);

// This creates a Node.js server that listens for incoming HTTP requests (including webhook payloads from GitHub) on the specified port. When the server receives a request, it executes the `middleware` function that you defined earlier. Once the server is running, it logs messages to the console to indicate that it is listening.
http.createServer(middleware).listen(port, () => {
  console.log(`Server is listening for events at: ${localWebhookUrl}`);
  console.log('Press Ctrl + C to quit.')
});
