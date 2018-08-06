#!/bin/bash
echo Build started ...

cd jfrog-utils
echo In path: $(pwd)
rm -rf package-lock.json
rm -rf node_modules
rm -rf *.tgz
npm pack
cd ..

echo In path: $(pwd)
declare -a arr=("ArtifactoryGenericUpload" "ArtifactoryGenericDownload" "ArtifactoryPublishBuildInfo" "ArtifactoryPromote")

for i in "${arr[@]}"
do
    cd $i
    rm -rf package-lock.json
    rm -rf node_modules
    npm install
    cd ..
done

rm -rf jfrog-utils/node_modules
