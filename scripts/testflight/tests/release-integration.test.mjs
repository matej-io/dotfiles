import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const cli = fileURLToPath(new URL("../../../bin/testflight", import.meta.url));
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

function fixture(t, name) {
  const root = mkdtempSync(join(tmpdir(), "testflight-integration-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  const remote = join(root, "remote.git");
  const bin = join(root, "bin");
  mkdirSync(repo);
  mkdirSync(bin);
  git(root, "init", "--bare", "--quiet", remote);
  git(repo, "init", "--quiet", "-b", "main");
  git(repo, "config", "user.name", "Test");
  git(repo, "config", "user.email", "test@example.com");
  const c = JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)),
  );
  c.tokenFile = join(root, "token");
  const write = (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  write(join(repo, "config/testflight.json"), JSON.stringify(c));
  write(
    join(repo, c.secretsFile),
    JSON.stringify({
      keyId: "op://test/key/key-id",
      issuerId: "op://test/key/issuer-id",
      privateKey: "op://test/key/private-key",
    }),
  );
  write(join(root, "token"), "test-token");
  write(join(repo, ".gitignore"), ".local/\n.release/\n");
  for (const path of [c.exportOptions, c.uploadOptions])
    write(join(repo, path), "{}");
  write(join(repo, c.workspace ?? c.project, "placeholder"), "");
  if (c.podsDir) {
    write(join(repo, c.podsDir, "Podfile.lock"), "pods");
    write(join(repo, c.podsDir, "Pods/Manifest.lock"), "pods");
  }
  for (const path of c.requiredFiles ?? []) write(join(repo, path), "db");
  for (const step of c.preflight ?? []) {
    mkdirSync(join(repo, step.cwd), { recursive: true });
    if (step.command === "sh") write(join(repo, step.args[0]), "exit 0\n");
  }
  git(repo, "add", ".");
  git(repo, "commit", "--quiet", "-m", "fixture");
  git(repo, "remote", "add", "origin", remote);
  git(repo, "push", "--quiet", "-u", "origin", "main");
  const executable = (name, body) => {
    const path = join(bin, name);
    writeFileSync(path, `#!${process.execPath}\n${body}`, { mode: 0o755 });
  };
  executable(
    "op",
    `const f=process.argv[3].split('/').pop(); if(process.env.OP_SERVICE_ACCOUNT_TOKEN!=='test-token')process.exit(8); process.stdout.write({'key-id':'ABCDEFGHIJ','issuer-id':'12345678-1234-1234-1234-123456789abc','private-key':process.env.FAKE_KEY}[f]);`,
  );
  executable(
    "security",
    `console.log('  1) ${"A".repeat(40)} "Apple Distribution: Test"');`,
  );
  executable(
    "codesign",
    `if(process.argv.includes('-d')) console.log(JSON.stringify(JSON.parse(require('node:fs').readFileSync('config/testflight.json')).entitlements));`,
  );
  executable("swift", `if(process.env.FAIL_PREFLIGHT)process.exit(2);`);
  executable(
    "plutil",
    `const fs=require('node:fs'); const a=process.argv.slice(2); if(a[0]==='-convert')process.stdout.write(fs.readFileSync(0)); else {let v=JSON.parse(fs.readFileSync(a.at(-1))); for(const k of a[1].split('.'))v=v[k]; process.stdout.write(String(v));}`,
  );
  executable(
    "xcodebuild",
    `
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const a=process.argv.slice(2), c=JSON.parse(fs.readFileSync('config/testflight.json'));
fs.appendFileSync(process.env.CALLS,JSON.stringify(a)+'\\n');
const val=k=>a[a.indexOf(k)+1];
if(!a.includes('-exportArchive')) {assert.equal(val(c.workspace?'-workspace':'-project'),c.workspace??c.project);assert.equal(val('-configuration'),c.configuration);assert.equal(val('-scheme'),c.scheme);}
if(a.includes('-showBuildSettings'))console.log(JSON.stringify([{target:c.target,buildSettings:{PRODUCT_BUNDLE_IDENTIFIER:c.bundleId,DEVELOPMENT_TEAM:c.teamId,MARKETING_VERSION:'2.1.0',CURRENT_PROJECT_VERSION:'1'}}]));
else if(a.includes('archive')) {
 const archive=val('-archivePath'), app=path.join(archive,'Products/Applications',c.appName+'.app');fs.mkdirSync(app,{recursive:true});
 fs.writeFileSync(path.join(app,'Info.plist'),JSON.stringify({CFBundleIdentifier:c.bundleId,CFBundleShortVersionString:'2.1.0',CFBundleVersion:'6'}));
 fs.writeFileSync(path.join(archive,'Info.plist'),JSON.stringify({ApplicationProperties:{Team:c.teamId}}));
 for(const f of c.archiveFiles??[])fs.writeFileSync(path.join(app,f),'db');
 assert(a.includes('CURRENT_PROJECT_VERSION=6'));
} else {assert.equal(val('-exportOptionsPlist'),path.join(process.cwd(), process.env.EXPECT_UPLOAD==='1'?c.uploadOptions:c.exportOptions));}
`,
  );
  const mock = join(root, "fetch.mjs");
  write(
    mock,
    `import fs from 'node:fs';
globalThis.fetch=async (url,options)=>{
 const c=JSON.parse(fs.readFileSync('config/testflight.json'));const u=new URL(url);let data;
 if(u.pathname==='/v1/apps'){if(u.searchParams.get('filter[bundleId]')!==c.bundleId)throw Error('wrong app');data=[{id:'app',attributes:{bundleId:c.bundleId}}];}
 else if(u.pathname.endsWith('/buildUploads'))data=[{attributes:{cfBundleVersion:'5'}}];
 else if(u.pathname==='/v1/builds')data=u.searchParams.has('filter[version]')?[{id:'build',attributes:{processingState:'VALID',expired:false}}]:[{attributes:{version:'5'}}];
 else if(u.pathname.endsWith('/preReleaseVersion'))data={attributes:{version:'2.1.0',platform:'IOS'}};
 else if(u.pathname.endsWith('/buildBetaDetail'))data={attributes:{internalBuildState:'IN_BETA_TESTING'}};
 else if(u.pathname==='/v1/betaGroups'){if(u.searchParams.has('filter[app]'))throw Error('redundant relationship filter');data=[{id:'group',attributes:{isInternalGroup:true}}];}
 else throw Error('unexpected URL');
 return {ok:true,json:async()=>({data})};
};`,
  );
  const key = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  }).privateKey;
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    FAKE_KEY: key,
    CALLS: join(root, "calls"),
    NODE_OPTIONS: `--import=${mock}`,
  };
  delete env.OP_SERVICE_ACCOUNT_TOKEN;
  const invoke = (args, overrides = {}) =>
    spawnSync(process.execPath, [cli, "--repo", repo, ...args], {
      env: { ...env, ...overrides },
      encoding: "utf8",
      timeout: 30000,
    });
  return { root, repo, remote, c, invoke, env };
}

for (const name of ["hilma", "isum", "calorie"]) {
  test(`${name}: CLI dry run uses project checks and export settings without upload or tag`, (t) => {
    const f = fixture(t, name);
    const result = f.invoke(["release", "--dry-run"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const base = join(f.repo, f.c.artifactDir);
    const run = readdirSync(base)[0];
    const record = JSON.parse(readFileSync(join(base, run, "release.json")));
    assert.equal(record.outcome, "exported");
    assert.equal(record.build, "6");
    assert.match(record.toolRevision, /^[0-9a-f]{40}$/);
    assert.equal(git(f.repo, "tag"), "");
    assert.equal(existsSync(join(base, "release.lock")), false);
    assert(
      !readFileSync(f.env.CALLS, "utf8").includes("testflight-upload.plist"),
    );
  });
}

test("upload flow tags the released commit and detects internal availability", (t) => {
  const f = fixture(t, "calorie");
  const result = f.invoke(["release"], { EXPECT_UPLOAD: "1" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const base = join(f.repo, f.c.artifactDir),
    run = readdirSync(base)[0];
  const record = JSON.parse(readFileSync(join(base, run, "release.json")));
  assert.equal(record.outcome, "uploaded");
  assert.equal(record.processing.ready, true);
  assert.equal(git(f.repo, "tag"), "testflight/calorie-2.1.0-6");
  assert.equal(
    git(f.remote, "rev-parse", "testflight/calorie-2.1.0-6^{commit}"),
    record.sha,
  );
  assert.equal(existsSync(join(base, run, "source")), false);
});

test("failed project tests stop before archive or upload", (t) => {
  const f = fixture(t, "calorie");
  const result = f.invoke(["release"], { FAIL_PREFLIGHT: "1" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /swift failed/);
  assert.equal(existsSync(f.env.CALLS), false);
  assert.equal(git(f.repo, "tag"), "");
});

test("whats-new honors the configured Calorie tag prefix", (t) => {
  const f = fixture(t, "calorie");
  git(f.repo, "tag", "testflight/calorie-2.1.0-5");
  git(f.repo, "tag", "testflight/2.1.0-999");
  const result = f.invoke(["whats-new"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Since testflight\/calorie-2.1.0-5/);
});

test("release policy drift is rejected before building", (t) => {
  const f = fixture(t, "hilma");
  writeFileSync(
    join(f.repo, "config/testflight.json"),
    JSON.stringify({ ...f.c, configuration: "Release" }),
  );
  const result = f.invoke(["release", "--dry-run"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /config differs/);
  assert.equal(existsSync(f.env.CALLS), false);
});
