const greenFilter = 'invert(25%) sepia(14%) saturate(3278%) hue-rotate(99deg) brightness(94%) contrast(89%)';
const greenText = '#0e5a2e';
const greenBG = '#85daaa';

const redFilter = 'invert(39%) sepia(9%) saturate(5118%) hue-rotate(318deg) brightness(80%) contrast(113%)';
const redText = '#cc3232';
const redBG = '#ffd6d6';

var tickIMG = false;
var infoIMG = false;

var bottomNotificationElem = false;
var botNotifTO = false;
var ongoingQueue = false;
var botNotifQueue = [];

function bottomNotification(from, target = "", queued=false){

    if(botNotifTO || ongoingQueue && !queued){
        ongoingQueue = true;
        botNotifQueue.push([from, target]);
        return;
    };

    $('.bottomNotification_Icon').css({
        "transform": "unset",
        "display": "block"
    });

    // Success: only 'updated' is used in this app
    if(["updated"].includes(from)){
        $('.bottomNotification_Icon').css('filter', greenFilter);
        $(".bottomNotification_msg").css('color', greenText);
        $('.bottomNotification').css("backgroundColor", greenBG);

        $(".bottomNotification_Icon").css('scale', "1");
        $(".bottomNotification_Icon").attr('src', tickIMG);

        $(".bottomNotification_msg").text(target || "Mise à jour effectuée");
    }else if(["missingFields", "invalid", "invalidNumber", "invalidTime", "duplicateTime", "invalidProfile"].includes(from)){
        $('.bottomNotification_Icon').css('filter', redFilter);
        $(".bottomNotification_msg").css('color', redText);
        $('.bottomNotification').css("backgroundColor", redBG);

        $(".bottomNotification_Icon").attr('src', infoIMG);

        $(".bottomNotification_Icon").css('scale', "1.1");

        // Prefer the provided target message; otherwise show a sensible default
        const defaults = {
            missingFields: "Veuillez remplir tous les champs",
            invalid: "Entrées invalides",
            invalidNumber: "Valeur numérique invalide",
            invalidTime: "Heure invalide",
            duplicateTime: "Un rappel existe déjà à cette heure",
            invalidProfile: "Profils invalides"
        };
        $(".bottomNotification_msg").text(target || defaults[from] || "Erreur de validation");
    };

    setTimeout(() => {summonBottomNotification()}, 300);
};

function animateShow(element, targetBottom, duration) {
    const start = performance.now();
    const initialBottom = parseFloat(getComputedStyle(element).bottom);

    function update(time) {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      element.style.bottom = `${initialBottom + progress * (targetBottom - initialBottom)}px`;

      if (progress < 1) {
        requestAnimationFrame(update);
      };
    };

    requestAnimationFrame(update);
};

function animateHide(element, targetBottom, duration) {
    const startBottom = parseFloat(getComputedStyle(element).bottom);
    const distance = targetBottom - startBottom;
    const startTime = performance.now();

    function update(time) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      element.style.bottom = `${startBottom + distance * progress}px`;

      if(progress >= 1){
        clearTimeout(botNotifTO);
        botNotifTO = false;
      };

      if (progress < 1) {
        requestAnimationFrame(update);
      }else if(botNotifQueue.length > 0){
        bottomNotification(botNotifQueue[0][0], botNotifQueue[0][1], true);
        botNotifQueue.shift();
      }else if (botNotifQueue.length == 0){
        ongoingQueue = false;
      };
    };

    requestAnimationFrame(update);
};

function summonBottomNotification(){
    $('.bottomNotification').css("display", "flex");
    $(".bottomNotification").css("bottom", "-55px");

    animateShow(bottomNotificationElem, 25, 150);

    botNotifTO = setTimeout(() => {
        animateHide(bottomNotificationElem, -55, 150);
        setTimeout(() => {
            $('.bottomNotification').css("display", "none");
        }, 150);
    }, 1800);
};

$(document).ready(function(){
    tickIMG = $("#tickIMG").attr('src');
    infoIMG = $("#infoIMG").attr('src');

    bottomNotificationElem = document.querySelector('.bottomNotification');
});//readyEnd
