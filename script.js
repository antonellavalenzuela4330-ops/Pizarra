document.addEventListener("DOMContentLoaded", function(){
    const uploadImg = document.getElementById('upload-img')
    const uploadDoc = document.getElementById('upload-doc')
    const fileInput = document.getElementById('file-input')

    function init() {
        uploadImg.addEventListener('clcik', () => fileInput.click());
        uploadDoc.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', handleFileUpload);
    }
})