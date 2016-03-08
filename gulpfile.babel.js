/**
 *
 *  Front-end Tooling
 *  Version 1.0.12
 *  Author: Faizal Sahebdin
 *  Copyright 2016 Salmon. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License
 *
 *  Using the new JavaScript features from ES2015, babel is taking care of compilation
 *      https://babeljs.io/docs/learn-es2015/
 *  See http://www.html5rocks.com/en/tutorials/service-worker/introduction/ for
 *  an in-depth explanation of what service workers are and why you should care.
 *
 */

'use strict';

import path from 'path';
import gulp from 'gulp';
import del from 'del';
import gulpLoadPlugins from 'gulp-load-plugins';
import runSequence from 'run-sequence';
import browserSync from 'browser-sync';
import swPrecache from 'sw-precache';
import { output as pagespeed } from 'psi';
import pkg from './package.json';

// configuration Variables
const defaultConfig = {
  appPath: './app/',
  sassPath: './app/css/',
  jsPath: './app/javascript/salmon/modules/',
  imagePath: './app/images/',
  testPath: './dev/tests/js/jasmine/',
  fonts: './app/css/font/',
  bower: './bower_components',
  node: './node_modules',
  distributionFolder: './dist',
  sassStyle: 'compressed', //compressed, expanded, nested
  prefixBrowsers: ['last 3 versions', 'ie >= 8', 'ie_mob >= 10', 'ff >= 21', 'chrome >= 28', 'safari >= 6', 'opera >= 11', 'ios >= 7', 'android >= 4.4', 'bb >= 10', '> 1%']
};
const magentoConfig = {
  appPath: './app/design/frontend/Salmon/base/',
  sassPath: './app/design/frontend/Salmon/base/',
  jsPath: './app/design/frontend/Salmon/base/web/js/',
  imagePath: './app/design/frontend/Salmon/base/web/images/',
  testPath: './dev/tests/js/jasmine/',
  fonts: './app/design/frontend/Salmon/base/web/fonts/',
  bower: './bower_components',
  node: './node_modules',
  distributionFolder: './dist',
  sassStyle: 'compressed', //compressed, expanded, nested
  prefixBrowsers: ['last 3 versions', 'ie >= 8', 'ie_mob >= 10', 'ff >= 21', 'chrome >= 28', 'safari >= 6', 'opera >= 11', 'ios >= 7', 'android >= 4.4', 'bb >= 10', '> 1%']
};
const config = pkg.magento ? magentoConfig : pkg.websphere ? ibmConfig : defaultConfig
const $$ = gulpLoadPlugins();
const reload = browserSync.reload;
const scssIncludeFiles = path.join(config.sassPath, '**/*.s+(a|c)ss');
const cssIncludeFiles = path.join(config.sassPath, '**/*.css');
const jsIncludeFiles = path.join(config.jsPath, '**/*.js');
const jsExcludeFiles = path.join(config.jsPath, '**/*.min.js');
const imgIncludeFiles = path.join(config.imagePath + '**/*.{gif,jpg,png,svg}');
const srcIncludeFiles = path.join(config.appPath, '**/*.{php,jsp,jspf,htm*}');
const testPath = path.join(config.testPath, 'spec_runner/index.js');
const swFile = 'service-worker.js';

// notification, choose method via config
var onError = function(err) {
  pkg.notifyViaConsole ? $$.util.log(err.message) : $$.notify.onError()(err);
  this.emit('end');
};

// ignore stream error, for testing
var ignore = function() {
  this.emit('end');
};

// the default task
gulp.task('default', ['greet'], cb =>
  runSequence(
    ['clean', 'scsslint', 'sass', 'jslint', 'jsmin', 'images'],
    //'pagespeed',
    //'copy',
    'gsw',
    'watchers',
    //'sync',
    cb
  )
);

// greet
gulp.task('greet', () =>
  $$.util.log($$.util.colors.green('Hello, tasks are initialising for ' + pkg.name))
);

// compile sass
gulp.task('sass', () =>
  gulp.src(scssIncludeFiles)
  .pipe($$.plumber({
    errorHandler: onError
  }))
  .pipe($$.cached('sass'))
  .pipe($$.progeny({
    regexp: /^\s*@import\s*(?:\(\w+\)\s*)?['"]([^'"]+)['"]/
  }))
  .pipe($$.filter(['**/*.s+(a|c)ss', '!**/_*.s+(a|c)ss']))
  .pipe($$.newer(cssIncludeFiles))
  .pipe($$.if(pkg.debug, $$.sourcemaps.init({ identityMap: pkg.debug })))
  .pipe($$.sass({
    errLogToConsole: false,
    precision: 10,
    style: config.sassStyle,
    includePaths: [
      config.sassPath,
      config.bower,
      config.bootstrap
    ]
  }))
  .pipe($$.autoprefixer({ browsers: config.prefixBrowsers }))
  .pipe($$.if(pkg.production, $$.cssnano()))
  .pipe($$.if(pkg.production, $$.size({ title: 'styles' })))
  .pipe($$.if(pkg.debug, $$.sourcemaps.write('.')))
  .pipe(gulp.dest((file) => file.base))
);

// lint sass
gulp.task('scsslint', () =>
  gulp.src(scssIncludeFiles)
  .pipe($$.plumber({
    errorHandler: onError
  }))
  .pipe($$.cached('sassLint'))
  .pipe($$.progeny({
    regexp: /^\s*@import\s*(?:\(\w+\)\s*)?['"]([^'"]+)['"]/
  }))
  .pipe($$.filter(['**/*.s+(a|c)ss', '!**/_*.s+(a|c)ss']))
  .pipe($$.newer(scssIncludeFiles))
  .pipe($$.scssLint({
    config: 'lint.yml',
    maxBuffer: 4194304
  }))
);

// minify js
gulp.task('jsmin', () =>
  gulp.src([jsIncludeFiles, '!' + jsExcludeFiles])
  //.pipe($$.util.log(jsExcludeFiles))
  .pipe($$.plumber({
    errorHandler: onError
  }))
  .pipe($$.cached('jsmin'))
  .pipe($$.filter('**/*.js'))
  .pipe($$.newer(jsIncludeFiles))
  .pipe($$.if(pkg.debug, $$.sourcemaps.init({ identityMap: pkg.debug })))
  .pipe($$.babel())
  .pipe($$.uglify({ preserveComments: 'some' }))
  .pipe($$.rename({ suffix: '.min' }))
  .pipe($$.if(pkg.debug, $$.sourcemaps.write('.')))
  .pipe($$.if(pkg.production, $$.size({ title: 'scripts' })))
  .pipe(gulp.dest((file) => file.base))
);

// lint js - extending http://google.github.io/styleguide/javascriptguide.xml
gulp.task('jslint', () =>
  gulp.src([jsIncludeFiles, '!' + jsExcludeFiles])
  .pipe($$.plumber({
    errorHandler: onError
  }))
  .pipe($$.cached('jslint'))
  .pipe($$.filter('**/*.js'))
  .pipe($$.newer(jsIncludeFiles))
  .pipe($$.eslint({
    'extends': 'google',
    'rules': {
      // Override any settings from the "parent" configuration
      'eqeqeq': 1,
      'max-len': 0,
      'require-jsdoc': 0,
      'jquery': 1,
    }
  }))
  .pipe($$.eslint.format())
  .pipe($$.if(!browserSync.active && !pkg.enableSync, $$.eslint.failOnError()))
);

// image optimisation
gulp.task('images', () =>
  gulp.src(imgIncludeFiles)
  .pipe($$.plumber({
    errorHandler: onError
  }))
  .pipe($$.cached('img'))
  .pipe($$.newer(imgIncludeFiles))
  .pipe($$.filter('**/*.{gif,jpg,png,svg}'))
  .pipe($$.imagemin({
    progressive: true,
    svgoPlugins: [{ removeViewBox: false }],
    // png optimization
    optimizationLevel: pkg.production ? 3 : 1
  }))
  .pipe($$.if(pkg.production, $$.size({ title: 'images' })))
  .pipe(gulp.dest((file) => file.base))
);

// unit tests
gulp.task('jasmine', () =>
  gulp.src(testPath)
  .pipe($$.jasmine())
);

// browserSync for changes & reload
gulp.task('serve', ['sass', 'jsmin'], () => {
  browserSync({
    notify: false,
    // Customize the Browsersync console logging prefix
    logPrefix: 'WSK',
    // Allow scroll syncing across breakpoints
    scrollElementMapping: ['main', '.mdl-layout'],
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: ['.tmp', config.appPath],
    port: 3000
  });

  gulp.watch(srcIncludeFiles, reload);
  gulp.watch(cssIncludeFiles, reload);
  gulp.watch(jsIncludeFiles, reload);
  gulp.watch(imgIncludeFiles, reload);
});

// browserSync and serve the output from the dist build
gulp.task('serve:dist', ['default'], () =>
  browserSync({
    notify: false,
    logPrefix: 'WSK',
    // Allow scroll syncing across breakpoints
    scrollElementMapping: ['main', '.mdl-layout'],
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: config.appPath,
    port: 3001
  })
);

// hadrcore cleaning
gulp.task('clean', () =>
  del(['.tmp', 'dist/**/*', '!dist/.git'])
);

// dist all files at the root level (app)
gulp.task('copy', () =>
  gulp.src([
    'app/**/*',
    '!**/*.scss',
    '!**/*.css.map',
    '!*/Magento/**/*',
    '!app/*.html',
    'node_modules/apache-server-configs/dist/.htaccess'
  ], {
    dot: true
  })
  .pipe($$.plumber({
    errorHandler: onError
  }))
  .pipe(gulp.dest(config.distributionFolder))
  .pipe($$.size({ title: 'copy' }))
);

// concatenate all relevant files defined within
gulp.task('concat', () =>
  // <!-- build:<type> <path> -->
  // ... HTML Markup, list of script / link tags. see more here https://www.npmjs.com/package/gulp-useref
  // <!-- endbuild -->
  gulp.src(cssIncludeFiles, jsIncludeFiles)
  .pipe($$.plumber({
    errorHandler: onError
  }))
  .pipe($$.useref())
  .pipe($$.if('*.js', $$.uglify()))
  .pipe(gulp.dest((jsFile) => jsFile.base))
  .pipe($$.if('*.css', $$.cssnano()))
  .pipe(gulp.dest((cssFile) => cssFile.base))
);

// run pageSpeed insights
gulp.task('pagespeed', cb =>
  // Update the below URL to the public URL of your site
  pagespeed(pkg.url, {
    strategy: 'mobile'
      // By default we use the PageSpeed Insights free (no API key) tier.
      // Use a Google Developer API key if you have one: http://goo.gl/RkN0vE
      // key: 'YOUR_API_KEY'
  }, cb)
);

// This should only be done for the 'dist' directory, to allow
// live reload to work as expected when serving from the 'app' directory.
gulp.task('gsw', ['copy-sw-scripts'], () =>
  swPrecache.write(swFile, {
    // Used to avoid cache conflicts when serving on localhost.
    cacheId: pkg.name || pkg.description,
    // sw-toolbox.js needs to be listed first. It sets up methods used in runtime-caching.js.
    importScripts: [
      './node_modules/sw-toolbox/sw-toolbox.js',
      'runtime-caching.js'
    ],
    staticFileGlobs: [
      imgIncludeFiles,
      jsIncludeFiles,
      cssIncludeFiles,
      srcIncludeFiles
    ],
    // Translates a static file path to the relative URL that it's served from.
    stripPrefix: path.join(config.appPath, path.sep)
  })
);

// Copy over the scripts that are used in importScripts as part of the generate-service-worker task.
gulp.task('copy-sw-scripts', () => {
  return gulp.src(['./node_modules/sw-toolbox/sw-toolbox.js', 'runtime-caching.js'])
    .pipe($$.plumber({
      errorHandler: onError
    }))
    .pipe(gulp.dest(config.distributionFolder + '/scripts'));
});

gulp.task('watchers', () => {
  gulp.watch(scssIncludeFiles, ['scsslint', 'sass']);
  gulp.watch(jsIncludeFiles, ['jslint', 'jsmin']);
  gulp.watch(imgIncludeFiles, ['images']);
});
gulp.task('lint', ['jslint', 'scsslint', 'jasmine'], function() {});
gulp.task('build', ['clean', 'build', 'copy'], function() {});
gulp.task('sync', ['sass', 'browser-sync'], () => {
  gulp.watch(['./**/*.html', 'js/**/*.js'], reload);
  gulp.watch(config.sassPath + '**/*.s+(a|c)ss', ['sass']);
});
