const R2_GET_ENDPOINT = "https://r2.askhb.no"
const R2_PUT_ENDPOINT = "https://worker.askhb.no"

const EDUCATION_PATH = "/education.json"
const EXPERIENCE_PATH = "/experiences.json"
const PERSONAL_INFO_PATH = "/personalinfo.json"
const CV_PATH = "/cv.pdf"
const PROFILE_PICTURE_PATH = "/profilepicture.png"
const PROJECTS_PATH = "/projects.json"

// Uploaded images are keyed by directory so a logo can never collide with a
// screenshot of the same name.
//
// Read that as the stronger statement it is: the directory is the *only* thing
// separating two namespaces. entryPrefix in func/keys.ts is a pure function of
// (dir, owner), and its suffix is a fingerprint of the owner's name rather than
// anything random -- deterministic on purpose, so re-uploading an entry's asset
// overwrites in place. So two owners with the same name string in the same
// directory compute the same prefix, and the same file name then lands on the
// same key. Uploads publish on pick, R2 has no versioning here and the worker
// has no DELETE, so that overwrite is silent and final.
//
// Projects therefore get their own directory rather than sharing the
// organisations' one. A project named after the employer it was built for is an
// ordinary thing to add, and it must not be able to destroy that employer's
// mark.
const LOGO_DIR = "/logos/"
const PROJECT_LOGO_DIR = "/project-logos/"
const SCREENSHOT_DIR = "/screenshots/"

// The worker route that renders a page and stores the result, rather than taking
// bytes uploaded from here.
const SCREENSHOT_ENDPOINT = R2_PUT_ENDPOINT + "/screenshot"

// The site's header photo, at the key every upload overwrites. Also the
// fallback the site itself falls back to, so it is what a reader sees until
// personalInfo carries a URL of its own.
const R2_PROFILE_PICTURE = R2_GET_ENDPOINT + PROFILE_PICTURE_PATH

const PAGES_BASE_URL = "https://pages.askhb.no"
const PAGES_CONTENT_INDEX_URL = PAGES_BASE_URL + "/static/contentIndex.json"

export { R2_GET_ENDPOINT, EDUCATION_PATH, EXPERIENCE_PATH, PERSONAL_INFO_PATH, CV_PATH, R2_PUT_ENDPOINT, PAGES_BASE_URL, PAGES_CONTENT_INDEX_URL, PROJECTS_PATH, LOGO_DIR, PROJECT_LOGO_DIR, SCREENSHOT_DIR, PROFILE_PICTURE_PATH, R2_PROFILE_PICTURE, SCREENSHOT_ENDPOINT }