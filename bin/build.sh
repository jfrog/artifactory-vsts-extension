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
declare -a arr=("ArtifactoryBuildPromotion" "ArtifactoryGenericDownload" "ArtifactoryGenericUpload" "ArtifactoryPublishBuildInfo")

for i in "${arr[@]}"
do
    cd tasks/$i
    rm -rf package-lock.json
    rm -rf node_modules
    npm install
    cd ../..
done

cd tests
rm -rf package-lock.json
rm -rf node_modules
npm install
cd ..

rm -rf jfrog-utils/node_modules
