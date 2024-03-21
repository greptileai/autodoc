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