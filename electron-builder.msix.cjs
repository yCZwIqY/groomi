const { build } = require('./package.json');

module.exports = {
  ...build,
  toolsets: {
    winCodeSign: '1.1.0',
  },
  extraMetadata: {
    description: '원고 관리 및 AI 리뷰를 위한 데스크톱 집필 앱',
  },
  directories: {
    ...build.directories,
    buildResources: 'assets/msix',
  },
  win: {
    ...build.win,
    target: [{ target: 'appx', arch: ['x64'] }],
  },
  appx: {
    artifactName: 'groomi-${version}-${arch}.msix',
    identityName: 'Jiyoon.Groomi',
    publisher: 'CN=A7A50734-9F2B-4CF6-BF3D-C57A60E8D0C6',
    publisherDisplayName: 'Jiyoon',
    applicationId: 'Groomi',
    displayName: 'Groomi',
    languages: ['ko-KR'],
    backgroundColor: 'transparent',
    minVersion: '10.0.19041.0',
    maxVersionTested: '10.0.19041.0',
    capabilities: ['internetClient', 'runFullTrust'],
  },
};
