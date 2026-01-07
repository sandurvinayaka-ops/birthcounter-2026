# EarthPulse | Global Live Birth Tracker

A high-performance cinematic visualization of live global births.

## How to Host on GitHub Pages (The Correct Way)

1. **Create a new Repository** on GitHub.
2. **Upload BOTH `index.html` and `index.tsx`** to the root of the repository. 
   *Note: Browsers cannot run `.tsx` files natively, but this version of `index.html` includes a browser-side compiler (Babel) to make it work automatically.*
3. Go to **Settings > Pages**.
4. Under "Build and deployment", set source to **Deploy from a branch**.
5. Select your **main** branch and **/(root)** folder, then click **Save**.
6. Wait 1-2 minutes for the site to build.

Your site will be live at `https://[your-username].github.io/[repo-name]/`.