import 'dotenv/config';
import ghpages from 'gh-pages';

function callback(err) {
  if (err) {
    console.error('Error during deployment:', err);
  } else {
    console.log('Deployment successful!');
  }
}
ghpages.publish(
  'dist',
  {
    nojekyll: true,
    repo: 'https://github.com/dimaslanjaka/browser-automation.git',
    branch: 'gh-pages',
    user: { name: 'dimaslanjaka', email: 'dimaslanjaka@gmail.com' },
    message: `Deploying to GitHub Pages: ${new Date().toISOString()}`
  },
  callback
);
