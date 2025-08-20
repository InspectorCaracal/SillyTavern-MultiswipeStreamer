import { getContext } from "../../../extensions.js";
import { showSwipeButtons } from "../../../../script.js";


let dlg;
let dom;
let swipes = [];
let cols = 0;
let streaming = false;

function cancelGen() {
	$('#send_form .mes_stop').click();
}

function endStream() {
	// change button text to 'done'
	const okButton = document.querySelector(".popup-button-ok");
	if (okButton) {
		okButton.innerText = "Done";
		okButton.setAttribute('data-i18n', 'Done');
	}
	// flag as no longer streaming
	streaming = false;
}

function closePopup() {
	if (dlg) {
		dlg.complete(true);
	}
}

function selectSwipe(swipe_id) {
	if (streaming) {
		// don't swap swipes until we're all done
		return;
	}
	// FIXME: this will only work if you're multiswiping a fresh message.
	// otherwise, it "works" but sets the current swipe to the wrong swipe #
	// this causes it to load the wrong swipe in on chat reload
	console.log('choosing swipe');
	const chat = getContext().chat;
	const mes_id = chat.length - 1;
	const mes = chat[mes_id];
	const mes_el = $(`.mes[mesid="${mes_id}"]`);
	mes.swipe_id = swipe_id;
	mes.mes = mes.swipes[swipe_id];
	// selective copying of the swipe to the main mes data
	const swipe = mes.swipe_info[swipe_id] ?? null;
	if (swipe != null) {
		mes.extra = structuredClone(swipe.extra);
		mes.send_data = swipe.send_date;
		mes.gen_started = swipe.gen_started;
		mes.gen_finished = swipe.gen_finished;
	}
	mes_el.find('.mes_text').innerHTML = getContext().messageFormatting(
		mes.mes,
		mes.name,
		mes.is_system,
		mes.is_user,
		mes_id,
	);
	mes_el.find('swipes-counter').textContent = `${swipe_id + 1}/${mes.swipes.length}`;
	getContext().saveChat();
   	const eventSource = getContext().eventSource;
	const event_types = getContext().event_types;
	eventSource.emit(event_types.MESSAGE_SWIPED, mes_id);
	showSwipeButtons();
	console.log('swipe chosen');
	// close the popup since we're done here
	closePopup();
}

function handleStream(text) {
	streaming = true;
	const streamingProcessor = getContext().streamingProcessor;
	if (!streamingProcessor) {
		return;
	}
	if (streamingProcessor.swipes.length > 0) {
		if (!dlg) {
			const Popup = getContext().Popup;
			dom = document.createElement('div');
			dom.classList.add('msw_popup');
			dlg = new Popup(dom, getContext().POPUP_TYPE.TEXT, null, {
				wide: true,
				wider: true,
				large: true,
				allowVerticalScrolling: true,
				okButton: "Stop",
				onClose: cancelGen
			});
			dlg.show();
			dlg.dlg.style.width = 'unset';
		}
		if (streamingProcessor.swipes.length > cols) {
			cols = streamingProcessor.swipes.length;
			dom.style.gridTemplateColumns = `repeat(${streamingProcessor.swipes.length + 1}, 1fr)`;
		}
		[text, ...streamingProcessor.swipes].forEach((swipe, idx)=>{
			if (!swipes[idx]) {
				const el = document.createElement('div');
				el.classList.add('mes');
				el.style.gridColumnStart = (idx + 1).toString();

				const inner = document.createElement('div');
				swipes[idx] = inner;
				inner.classList.add('mes_text');

				el.append(inner);
				dom.append(el);
				$(el).on('click', (e) => {
					// NOTE: this needs to be adjusted to account for pre-existing swipes
					selectSwipe(idx);
				});
			}
			swipes[idx].innerHTML = getContext().messageFormatting(swipe, 'stream', false, false, -1);
		});
	}
}

jQuery(async () => {
	const eventSource = getContext().eventSource;
	const event_types = getContext().event_types;
	eventSource.on(event_types.GENERATION_AFTER_COMMANDS, ()=>{
		dom = null;
		dlg = null;
		swipes = [];
		cols = 0;
	});
	eventSource.on(event_types.STREAM_TOKEN_RECEIVED, handleStream);
	eventSource.on(event_types.GENERATION_ENDED, endStream);
});
