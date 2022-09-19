import { buildFile } from "../file-builder/build-filepath.js";
import { socketlibSocket } from "../../socketset.js";
import { aaDebugger } from "../../constants/constants.js"
import { AAAnimationData } from "../../aa-classes/AAAnimationData.js";
const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

export async function templateSeq(handler, animationData, config) {

    const sourceToken = handler.sourceToken;

    const template = config ? config : canvas.templates.placeables[canvas.templates.placeables.length - 1];
    const templateData = config ? template || {}: template.document || {};;
    const templateType = templateData?.t;

    const data = animationData.primary;
    const secondary = animationData.secondary;
    const sourceFX = animationData.sourceFX;
    const targetFX = animationData.targetFX;
    const macro = animationData.macro;

    /*
    if (data.isAuto) {
        data.type = data.type;
        data.persistent = data.persist || false;
    } else {
        data.type = handler.flags?.options?.tempType;
    }

    if (data.animation === 'thunderwave') {
        thunderwaveAuto(handler, data);
        return;
    }
    */
    const tempAnimation = await buildFile(false, data.video.menuType, data.video.animation, "templatefx", data.video.variant, data.video.color, data.video.customPath)

    if (handler.debug) { aaDebugger("Template Animation Start", animationData, tempAnimation) }

    let globalDelay = game.settings.get("autoanimations", "globaldelay");
    await wait(globalDelay);


    const templateTypes = ['sphere', 'cylinder', 'radius']

    if (data.options.persistent && (data.options.persistType === 'overheadtile' || data.options.persistType === 'groundtile')) {

        let trueSize;
        if (templateType === 'rect') {
            if (game.modules.get("dnd5e-helpers")?.active && (game.settings.get("dnd5e-helpers", "gridTemplateScaling") === 2 || game.settings.get("dnd5e-helpers", "gridTemplateScaling") === 3) && templateTypes.includes(handler.item.system?.target?.type)) {
                trueSize = Math.sqrt(Math.pow(templateData.distance, 2) - Math.pow((handler.item.system?.target?.value * 2), 2));
            } else {
                trueSize = templateData.width;
            }
        } else {
            trueSize = templateData.distance * 2;
        }

        const templateLength = canvas.grid.size * (trueSize / canvas.dimensions.distance);
        const isOverhead = data.options.persistType === 'overheadtile' ? true : false;

        const tileWidth = templateLength * data.options.scaleX;
        const tileHeight = templateLength * data.options.scaleY;

        const tileX = templateType === 'circle' ? (templateData.x - (tileWidth / 2)) : (templateData.x + ((templateLength - tileWidth) / 2));
        const tileY = templateType === 'circle' ? (templateData.y - (tileHeight / 2)) : (templateData.y + ((templateLength - tileHeight) / 2));

        const templateObject = {
            alpha: data.options.opacity,
            width: tileWidth,
            height: tileHeight,
            img: tempAnimation.fileData,
            overhead: isOverhead, // false sets Tile in canvas.background. true sets Tile to canvas.foreground
            occlusion: {
                alpha: `${data.options.occlusionAlpha}`,
                mode: data.options.occlusionMode,
            },
            video: {
                autoplay: true,
                loop: true,
                volume: 0,
            },
            flags: {
                autoanimations: {
                    origin: handler.itemUuid,
                }
            },
            x: tileX,
            y: tileY,
            z: 100,
        }
        let aaSeq = await new Sequence("Automated Animations")
        // Play Macro if Awaiting
        if (macro && macro.playWhen === "1") {
            let userData = macro.args;
            aaSeq.macro(macro.name, handler.workflow, handler, userData)
        }
        // Extra Effects => Source Token if active
        if (sourceFX.enable) {
            aaSeq.addSequence(sourceFX.sourceSeq)
        }
        // Primary Sound
        if (data.sound) {
            aaSeq.addSequence(data.sound)
        }
        aaSeq.play()
        socketlibSocket.executeAsGM("placeTile", templateObject)
        if (data.removeTemplate) {
            if (data.persistType === 'overheadtile') {
                AAAnimationData.howToDelete("overheadtile")
            } else {
                AAAnimationData.howToDelete("groundtile")
            }
            canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [templateData._id])
        }
    } else {

        const templateType = templateData.t;

        let aaSeq = await new Sequence("Automated Animations")
        if ((data.options.persistent && data.options.persistType !== "attachtemplate") || !data.options.persistent) {
            aaSeq.thenDo(function () {
                if (data.options.removeTemplate) {
                    canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [template.id])
                }
            })
        }
        // Play Macro if Awaiting
        if (macro && macro.playWhen === "1") {
            let userData = macro.args;
            aaSeq.macro(macro.name, handler.workflow, handler, userData)
        }
        // Extra Effects => Source Token if active
        if (sourceFX.enable) {
            aaSeq.addSequence(sourceFX.sourceSeq)
        }
        // Primary Sound
        if (data.sound) {
            aaSeq.addSequence(data.sound)
        }
        aaSeq.thenDo(function () {
            Hooks.callAll("aa.animationStart", sourceToken, "no-target")
        })
        if (templateType === 'cone' || templateType === 'ray') {
            const trueHeight = templateType === 'cone' ? templateData.distance : templateData.width * 2;
            const coneRaySeq = aaSeq.effect()
            coneRaySeq.file(tempAnimation.file)
            coneRaySeq.size({
                width: (canvas.grid.size * (templateData.distance / canvas.dimensions.distance)) * data.options.scaleX,
                height: (canvas.grid.size * (trueHeight / canvas.dimensions.distance)) * data.options.scaleY,
            })
            coneRaySeq.opacity(data.options.opacity)
            coneRaySeq.origin(handler.itemUuid)
            coneRaySeq.elevation(data.options.elevation)
            coneRaySeq.zIndex(data.options.zIndex)
            coneRaySeq.rotate(data.options.rotate)
            if (data.options.isMasked) {
                coneRaySeq.mask(template)
            }
            if (data.options.persistent) {
                coneRaySeq.persist(true)
                if (data.options.persistType === 'attachtemplate') {
                    coneRaySeq.attachTo(template)
                    coneRaySeq.rotateTowards(template, {attachTo: true})
                } else {
                    coneRaySeq.atLocation(template, { cacheLocation: true })
                    coneRaySeq.rotateTowards(template, {cacheLocation: true})
                }
            } else {
                coneRaySeq.atLocation(template, { cacheLocation: true })
                coneRaySeq.repeats(data.options.repeat, data.options.repeatDelay)
                coneRaySeq.rotateTowards(template, {cacheLocation: true})
            }
            if (data.options.isWait) {
                coneRaySeq.waitUntilFinished(data.options.delay)
            }
        }

        if (templateType === 'circle' || templateType === 'rect') {
            let trueSize;
            if (templateType === 'rect') {
                if (game.modules.get("dnd5e-helpers")?.active && (game.settings.get("dnd5e-helpers", "gridTemplateScaling") === 2 || game.settings.get("dnd5e-helpers", "gridTemplateScaling") === 3) && templateTypes.includes(handler.item.system?.target?.type)) {
                    trueSize = Math.sqrt(Math.pow(templateData.distance, 2) - Math.pow((handler.item.system?.target?.value * 2), 2));
                } else {
                    trueSize = Math.sqrt(Math.pow(templateData.distance, 2)/2)
                }
            } else {
                trueSize = templateData.distance * 2;
            }
            let circRectSeq = aaSeq.effect()
            circRectSeq.file(tempAnimation.file)
            circRectSeq.size({
                width: canvas.grid.size * (trueSize / canvas.dimensions.distance) * data.options.scaleX,
                height: canvas.grid.size * (trueSize / canvas.dimensions.distance) * data.options.scaleY,
            })
            circRectSeq.opacity(data.options.opacity)
            circRectSeq.origin(handler.itemUuid)
            circRectSeq.elevation(data.options.elevation)
            circRectSeq.zIndex(data.options.zIndex)
            circRectSeq.rotate(data.options.rotate)
            if (data.options.isMasked) {
                circRectSeq.mask(template)
            }
            if (data.options.persistent) {
                circRectSeq.persist(true)
                if (data.options.persistType === 'attachtemplate') {
                    circRectSeq.attachTo(template, { followRotation: true })
                } else {
                    circRectSeq.atLocation(template, { cacheLocation: true })
                    circRectSeq.persist()
                }
            } else {
                circRectSeq.atLocation(template, { cacheLocation: true })
                circRectSeq.repeats(data.options.repeat, data.options.repeatDelay)
            }
            if (data.options.isWait) {
                circRectSeq.waitUntilFinished(data.options.delay)
            }
        }

        // secondary animation and sound
        if (secondary && handler.allTargets.length) {
            if (secondary.sound) {
                aaSeq.addSequence(secondary.sound)
            }
            for (let i = 0; i < handler.allTargets.length; i++) {
                //for (let currentTarget of handler.allTargets) {
                let currentTarget = handler.allTargets[i]
                let hit;
                if (handler.playOnMiss) {
                    hit = handler.hitTargetsId.includes(currentTarget.id) ? true : false;
                } else {
                    hit = true;
                }
                let secondarySeq = aaSeq.effect()
                secondarySeq.atLocation(currentTarget)
                secondarySeq.file(secondary.path?.file, true)
                secondarySeq.size(secondary.options.size * 2, { gridUnits: true })
                secondarySeq.repeats(secondary.options.repeat, secondary.options.repeatDelay)
                if (i === handler.allTargets.length - 1 && secondary.options.isWait && targetFX.enable) {
                    secondarySeq.waitUntilFinished(secondary.options.delay)
                } else if (!secondary.options.isWait) {
                    secondarySeq.delay(secondary.options.delay)
                }
                secondarySeq.elevation(secondary.options.elevation)
                secondarySeq.zIndex(secondary.options.zIndex)
                secondarySeq.opacity(secondary.options.opacity)
                secondarySeq.fadeIn(secondary.options.fadeIn)
                secondarySeq.fadeOut(secondary.options.fadeOut)
                if (secondary.options.isMasked) {
                    secondarySeq.mask(currentTarget)
                }
            }
        }

        if (macro && macro.playWhen === "0") {
            let userData = macro.args;
            new Sequence()
                .macro(macro.name, handler.workflow, handler, userData)
                .play()
        }
        if (handler.allTargets.length && targetFX.enable) {
            for (let target of handler.allTargets) {
                let targetSequence = AAAnimationData._targetSequence(targetFX, target, handler);
                aaSeq.addSequence(targetSequence.targetSeq)
            }
        }

        aaSeq.play()
        if (data.options.persistent && data.persistType === 'sequencerground') { AAAnimationData.howToDelete("sequencerground") }
        await wait(500)
        Hooks.callAll("aa.animationEnd", sourceToken, "no-target")
    }
}