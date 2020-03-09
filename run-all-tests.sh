dirs=$(find collectors/ -type d -maxdepth 1)
echo $dirs
for d in $dirs
do
    ( cd "$d" && echo "\n**********\n\nrunning tests for $d\n\n************\n\n" && npm run test )
done
