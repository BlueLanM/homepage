import gulp from "gulp";
import minifycss from "gulp-clean-css";
import uglify from "gulp-uglify";
import htmlmin from "gulp-htmlmin";
import cssnano from "gulp-cssnano";
import htmlclean from "gulp-htmlclean";
import del from "del";
import babel from "gulp-babel";
import autoprefixer from "gulp-autoprefixer";
import { server } from "gulp-connect";
import pug from "gulp-pug";
import less from "gulp-less";

import { readFileSync } from "fs";
const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url)));
const { task, src, dest, series, watch, parallel } = gulp;

task("clean", function() {
	return del(["./dist/css/", "./dist/js/"]);
});

task("css", function() {
	return src("./src/css/*.less")
		.pipe(less().on("error", function(err) {
			console.log(err);
			this.emit("end");
		}))
		.pipe(minifycss({ compatibility: "ie8" }))
		.pipe(autoprefixer({ overrideBrowserslist: ["last 2 version"] }))
		.pipe(cssnano({ reduceIdents: false }))
		.pipe(dest("./dist/css"));
});

task("html", function() {
	return src("./dist/index.html")
		.pipe(htmlclean())
		.pipe(htmlmin())
		.pipe(dest("./dist"));
});

task("js", function() {
	return src("./src/js/*.js")
		.pipe(babel({ presets: ["@babel/preset-env"] }))
		.pipe(uglify())
		.pipe(dest("./dist/js"));
});

task("pug", function() {
	return src("./src/index.pug")
		.pipe(pug({ data: config }))
		.pipe(dest("./dist"));
});

task("assets", function() {
	return src(["./src/assets/**/*"])
		.pipe(dest("./dist/assets"));
});

task("build", series("clean", "assets", "pug", "css", "js", "html"));

task("default", series("build"));

task("watch", function() {
	watch("./src/components/*.pug", parallel("pug"));
	watch("./src/index.pug", parallel("pug"));
	watch("./src/css/**/*.less", parallel(["css"]));
	watch("./src/js/*.js", parallel(["js"]));
	watch("./config.json", parallel(["pug"]));
	server({
		livereload: true,
		port: 8080,
		root: "dist"
	});
});