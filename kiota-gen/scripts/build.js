const shell = require("shelljs");

shell.rm("-rf", "dist");
shell.mkdir("dist");
shell.cp("-r", "bin", "dist");
shell.cp("package.json", "dist");
shell.cp("../README.md", "dist");
