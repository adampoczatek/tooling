/**
 *
 *  Front-end Tooling
 *  Version 1.0.6
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

const $$ = gulpLoadPlugins();
const reload = browserSync.reload;

// Configuration Variables
const config = {
  appPath: './app/',
  sassPath: './app/css/',
  jsPath: './app/javascript/salmon/modules/',
  imagePath: './app/images/',
  fonts: './app/css/font/',
  bower: './bower_components',
  node: './node_modules',
  distributionFolder: './dist',
  sassStyle: 'compressed', //compressed, expanded, nested
  prefixBrowsers: ['last 3 versions', 'ie >= 8', 'ie_mob >= 10', 'ff >= 21', 'chrome >= 28', 'safari >= 6', 'opera >= 11', 'ios >= 7', 'android >= 4.4', 'bb >= 10', '> 1%']
};
// Ye olde mess up - notification method
var onError = function(err) {
  pkg.notifyViaConsole ? $$.util.log(err.message) : $$.notify.onError()(err);
  this.emit('end');
};

// ignore stream error
var ignore = function() {
  this.emit('end');
};

// Greet
gulp.task('greet', () =>
  $$.util.log($$.util.colors.green('Hello, tasks are initialising for ' + pkg.name))
);

gulp.task('sass', () => {
  const includeFiles = config.sassPath + '**/*.s+(a|c)ss';
  gulp.src(config.sassPath + '**/*.s+(a|c)ss')
    .pipe($$.plumber({
      errorHandler: ignore
    }))
    .pipe($$.cached('sass'))
    .pipe($$.progeny({
      regexp: /^\s*@import\s*(?:\(\w+\)\s*)?['"]([^'"]+)['"]/
    }))
    .pipe($$.filter(['**/*.s+(a|c)ss', '!**/_*.s+(a|c)ss']))
    .pipe($$.newer(config.sassPath + '**/*.css'))
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
    .pipe(gulp.dest(config.sassPath))
});

// Sass Lint
gulp.task('scsslint', () => {
  const includeFiles = config.sassPath + '**/*.s+(a|c)ss';
  gulp.src(includeFiles)
    .pipe($$.plumber({
      errorHandler: ignore
    }))
    .pipe($$.cached('sassLint'))
    .pipe($$.progeny({
      regexp: /^\s*@import\s*(?:\(\w+\)\s*)?['"]([^'"]+)['"]/
    }))
    .pipe($$.filter(['**/*.s+(a|c)ss', '!**/_*.s+(a|c)ss']))
    .pipe($$.newer(includeFiles))
    .pipe($$.scssLint({
      config: 'lint.yml',
      maxBuffer: 4194304
    }))
});

// Js Lint - extends http://google.github.io/styleguide/javascriptguide.xml
gulp.task('jslint', () => {
  const includeFiles = config.jsPath + '**/*.js';
  const excludeFiles = '!' + config.jsPath + '**/*.min.js';
  gulp.src([includeFiles, excludeFiles])
    .pipe($$.plumber({
      errorHandler: onError
    }))
    .pipe($$.cached('jslint'))
    .pipe($$.filter('**/*.js'))
    .pipe($$.newer(includeFiles))
    .pipe($$.eslint({
      'extends': 'google',
      "rules": {
        // Override any settings from the "parent" configuration
        "eqeqeq": 1
      }
    }))
    .pipe($$.eslint.format())
    .pipe($$.if(!browserSync.active && !pkg.enableSync, $$.eslint.failOnError()))
});

// Minify js
gulp.task('jsmin', () => {
  const includeFiles = config.jsPath + '**/*.js';
  const excludeFiles = '!' + config.jsPath + '**/*.min.js';
  gulp.src([includeFiles, excludeFiles])
    .pipe($$.plumber({
      errorHandler: onError
    }))
    .pipe($$.cached('jsmin'))
    .pipe($$.filter('**/*.js'))
    .pipe($$.newer(includeFiles))
    .pipe($$.if(pkg.debug, $$.sourcemaps.init({ identityMap: pkg.debug })))
    .pipe($$.babel())
    .pipe($$.uglify({ preserveComments: 'some' }))
    .pipe($$.rename({ suffix: '.min' }))
    .pipe($$.if(pkg.debug, $$.sourcemaps.write('.')))
    .pipe($$.if(pkg.production, $$.size({ title: 'scripts' })))
    .pipe(gulp.dest(config.jsPath))
    .pipe(gulp.dest('dist/scripts'))
});

// Image optimisation
gulp.task('images', () =>
  gulp.src(config.imagePath + '**/*.{gif,jpg,png,svg}')
  .pipe($$.plumber({
    errorHandler: onError
  }))
  .pipe($$.cached('img'))
  .pipe($$.newer(config.imagePath + '**/*.{gif,jpg,png,svg}'))
  .pipe($$.filter('**/*.{gif,jpg,png,svg}'))
  //.pipe($$.newer(config.imagePath))
  .pipe($$.imagemin({
    progressive: true,
    svgoPlugins: [{ removeViewBox: false }],
    // png optimization
    optimizationLevel: pkg.production ? 3 : 1
  }))
  .pipe($$.if(pkg.production, $$.size({ title: 'images' })))
  .pipe(gulp.dest(config.imagePath))
);

// Watch files for changes & reload
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

  gulp.watch([config.appPath + '**/*.{php,jsp,jspf,htm*}'], reload);
  gulp.watch([config.sassPath + '**/*.css'], reload);
  gulp.watch([config.jsPath + '**/*.js'], reload);
  gulp.watch([config.imagePath + '**/*.{gif,jpg,png,svg}'], reload);
});

// Hadrcore cleaning
gulp.task('clean', () =>
  del(['.tmp', 'dist/**/*', '!dist/.git'])
);

// Build and serve the output from the dist build
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

// Copy all files at the root level (app)
gulp.task('copy', () =>
  gulp.src([
    'app/**/*',
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

// Concatenate all relevant files defined within
// <!-- build:<type> <path> -->
// ... HTML Markup, list of script / link tags.
// <!-- endbuild -->
gulp.task('build', function() {
  return gulp.src(config.appPath + '*.{js,css}*')
    .pipe($$.plumber({
      errorHandler: onError
    }))
    .pipe($$.useref())
    .pipe($$.if('*.js', $$.uglify()))
    .pipe(gulp.dest('.'))
    .pipe($$.if('*.css', $$.cssnano()))
    .pipe(gulp.dest('.'))
    .pipe(gulp.dest(config.distributionFolder));
});

// Run PageSpeed Insights
gulp.task('pagespeed', cb =>
  // Update the below URL to the public URL of your site
  pagespeed(pkg.url, {
    strategy: 'mobile'
      // By default we use the PageSpeed Insights free (no API key) tier.
      // Use a Google Developer API key if you have one: http://goo.gl/RkN0vE
      // key: 'YOUR_API_KEY'
  }, cb)
);

// Copy over the scripts that are used in importScripts as part of the generate-service-worker task.
gulp.task('copy-sw-scripts', () => {
  return gulp.src(['./node_modules/sw-toolbox/sw-toolbox.js', 'runtime-caching.js'])
    .pipe($$.plumber({
      errorHandler: onError
    }))
    .pipe(gulp.dest(config.distributionFolder + '/scripts'));
});

// Generate a service worker file that will provide offline functionality for
// local resources. This should only be done for the 'dist' directory, to allow
// live reload to work as expected when serving from the 'app' directory.
gulp.task('gsw', ['copy-sw-scripts'], () => {
  const rootDir = config.appPath;
  const filepath = 'service-worker.js';
  $$.util.log(filepath);
  return swPrecache.write(filepath, {
    // Used to avoid cache conflicts when serving on localhost.
    cacheId: pkg.name || pkg.description,
    // sw-toolbox.js needs to be listed first. It sets up methods used in runtime-caching.js.
    importScripts: [
      './node_modules/sw-toolbox/sw-toolbox.js',
      'runtime-caching.js'
    ],
    staticFileGlobs: [
      // Add/remove glob patterns to match your directory setup.
      config.imagePath + '**/*.{gif,jpg,png,svg}',
      config.jsPath + '**/*.js',
      config.sassPath + '**/*.css',
      config.appPath + '**/*.{php,jsp,jspf,htm*}'
    ],
    // Translates a static file path to the relative URL that it's served from.
    stripPrefix: path.join(config.appPath, path.sep)
  })
});


// Build production files, the default task
gulp.task('default', ['greet'], cb =>
  runSequence(
    ['clean', 'scsslint', 'sass', 'jslint', 'jsmin', 'images'],
    //'pagespeed',
    'copy',
    'gsw',
    'watchers',
    //'sync',
    cb
  )
);
gulp.task('watchers', () => {
  gulp.watch(config.sassPath + '**/*.s+(a|c)ss', ['scsslint', 'sass', 'gsw']);
  gulp.watch(config.jsPath + '**/*.js', ['jslint', 'jsmin', 'gsw']);
  gulp.watch(config.imagePath + '**/*.{gif,jpg,png,svg}', ['images', 'gsw']);
});
gulp.task('lint', ['jslint', 'scsslint'], function() {});
gulp.task('build', ['clean', 'build', 'copy'], function() {});
gulp.task('sync', ['sass', 'browser-sync'], function() {
  gulp.watch(['./**/*.html', 'js/**/*.js'], reload);
  gulp.watch(config.sassPath + '**/*.s+(a|c)ss', ['sass']);
});
