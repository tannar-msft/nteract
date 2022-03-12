## The nteract Release Process

This document outlines logistics around how releases are handled in the nteract project, specifically the applications and npm packages within this repository.

## Release Process for Packages

Releases for JavaScript packages in the monorepo happen automatically whenever a pull request is merged into the `main` branch of the repo. These automated releases are faciliated by the [semantic-release tool](https://github.com/semantic-release/semantic-release) release that is configured on the repo. In order to support automated releases, commits on this repo **MUST** follow the [conventional commit guidelines](https://www.conventionalcommits.org/en/v1.0.0/). This convention is enforced by a linter that runs on each invocation of `git commit`.

## Release Process for Desktop App

The nteract desktop app is shipped on a monthly cadence. You can ship nteract desktop releases from any operating system, with one notable exception. Due to technical limitations, macOS releases can only be shipped on macOS. On the topic of macOS...

### A special note for macOS

In order to build a signed copy with working auto-update, you will need to join the Apple developer program and get a certificate. The [Electron docs have a document on submitting your app to the app store](https://github.com/electron/electron/blob/master/docs/tutorial/mac-app-store-submission-guide.md), you only have to get through to the certificate step. Note, that the certificate that you will need to download from the Apple Developer Program portal is called the "3rd Party Mac Developer Application" certificate.

### All platform precursor

To be able to publish a release you'll need to generate a GitHub access token by going to <https://github.com/settings/tokens/new>. The access token should have the `repo` scope/permission. Once you have the token, assign it to an environment variable (on macOS/linux):

```bash
export GH_TOKEN="<YOUR_TOKEN_HERE>"
```

If you are on Windows, you can assign it as an environment using the following command in Command Prompt.

```
> setx GH_TOKEN "<YOUR_TOKEN_HERE>"
```

Note that `setx` will apply the environment variable in subsequence Command Prompt sessions.

**Note: Make sure that your remote origin is set as `git@github.com:nteract/nteract.git`.**

1.  Make sure the release is working by running `yarn dist` and testing the built app inside the `./applications/desktop/dist/` folder. You can build for all platforms using `yarn dist:all`.

2.  Double check that publish will really work by running `yarn verifyBeforePublish` first

3.  Run `npx lerna publish` to publish everything, which also runs the verification steps. You will have to pick versions for everything.

4.  Run the following to ship the built desktop app. This will generate the platform-specific assets and create a draft release on GitHub with the assets.

```
yarn ship:desktop
```

5.  From GitHub go to [nteract's releases](https://github.com/nteract/nteract/releases), verify everything works and edit the release notes. The name should follow our [naming guidelines](https://github.com/nteract/naming), namely that we use the last name of the next scientist in the list with an adjective in front.
    Example:

```bash
Last release: Avowed Avogadro
Next Scientist: Babbage
Next release: Babbling Babbage
```

You can pick alliterative adjectives by using the local dictionary and our friend `grep`:

```bash
$ cat /usr/share/dict/words | grep "^babb"
babbitt
babbitter
babblative
babble
babblement
babbler
babblesome
babbling
babblingly
babblish
babblishly
babbly
babby
```

6.  Once you're ready click "Publish release". On macOS and Windows, the update will be automatically downloaded and installed on user's machines.
