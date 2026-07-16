(**************************************************************************)
(*                                                                        *)
(*                                 VSRocq                                 *)
(*                                                                        *)
(*                   Copyright INRIA and contributors                     *)
(*       (see version control and README file for authors & dates)        *)
(*                                                                        *)
(**************************************************************************)
(*                                                                        *)
(*   This file is distributed under the terms of the MIT License.         *)
(*   See LICENSE file.                                                    *)
(*                                                                        *)
(**************************************************************************)

[%%if rocq = "8.18" || rocq = "8.19" || rocq = "8.20"]
module Grammar = Pcoq
[%%else]
module Grammar = Procq
[%%endif]

type part =
  | Literal of string
  | Hole of string

let trim = String.trim

let starts_with ~prefix text =
  let prefix_length = String.length prefix in
  String.length text >= prefix_length &&
  String.sub text 0 prefix_length = prefix

let quoted_string text =
  match String.index_opt text '"' with
  | None -> None
  | Some start ->
    let rec find_stop escaped i =
      if i >= String.length text then None
      else match text.[i], escaped with
      | '"', false -> Some i
      | '\\', false -> find_stop true (i + 1)
      | _, _ -> find_stop false (i + 1)
    in
    Option.map (fun stop ->
        let contents = String.sub text (start + 1) (stop - start - 1) in
        try Scanf.unescaped contents with Scanf.Scan_failure _ -> contents)
      (find_stop false (start + 1))

let split_top_level separator text =
  let add_piece pieces start stop =
    let piece = trim (String.sub text start (stop - start)) in
    if piece = "" then pieces else piece :: pieces
  in
  let rec loop pieces start depth quoted escaped i =
    if i = String.length text then List.rev (add_piece pieces start i)
    else
      let character = text.[i] in
      if quoted then
        let quoted, escaped =
          match character, escaped with
          | '"', false -> false, false
          | '\\', false -> true, true
          | _, _ -> true, false
        in
        loop pieces start depth quoted escaped (i + 1)
      else
        match character with
        | '"' -> loop pieces start depth true false (i + 1)
        | '[' -> loop pieces start (depth + 1) false false (i + 1)
        | ']' -> loop pieces start (depth - 1) false false (i + 1)
        | c when c = separator && depth = 0 ->
          loop (add_piece pieces start i) (i + 1) depth false false (i + 1)
        | _ -> loop pieces start depth false false (i + 1)
  in
  loop [] 0 0 false false 0

let matching_bracket text start =
  let rec loop depth quoted escaped i =
    if i >= String.length text then String.length text
    else if quoted then
      let quoted, escaped =
        match text.[i], escaped with
        | '"', false -> false, false
        | '\\', false -> true, true
        | _, _ -> true, false
      in
      loop depth quoted escaped (i + 1)
    else
      match text.[i] with
      | '"' -> loop depth true false (i + 1)
      | '[' -> loop (depth + 1) false false (i + 1)
      | ']' when depth = 1 -> i
      | ']' -> loop (depth - 1) false false (i + 1)
      | _ -> loop depth false false (i + 1)
  in
  loop 1 false false (start + 1)

let production_bodies grammar =
  let level = Str.regexp
      "\\[[ \t\n\r]*\\(\"[^\"]*\"[ \t\n\r]+\\)?\\(LEFTA\\|RIGHTA\\|NONA\\|BOTHA\\)[ \t\n\r]+\\["
  in
  let rec collect bodies offset =
    try
      ignore (Str.search_forward level grammar offset);
      let start = Str.match_end () - 1 in
      let stop = matching_bracket grammar start in
      let body = String.sub grammar (start + 1) (stop - start - 1) in
      collect (body :: bodies) (stop + 1)
    with Not_found -> List.rev bodies
  in
  collect [] 0

let first_word text =
  match String.index_opt text ' ' with
  | None -> text
  | Some stop -> String.sub text 0 stop

let hole_name symbol =
  let symbol = trim symbol in
  if starts_with ~prefix:"LIST0 " symbol || starts_with ~prefix:"LIST1 " symbol then
    let argument = String.sub symbol 6 (String.length symbol - 6) in
    let argument = List.hd (split_top_level ' ' argument) in
    argument ^ "s"
  else if starts_with ~prefix:"[" symbol then "choice"
  else
    match first_word symbol with
    | "IDENT" -> "identifier"
    | "NUMBER" -> "number"
    | "STRING" -> "string"
    | name -> name

let part_of_symbol symbol =
  let symbol = trim symbol in
  if symbol = "" || symbol = "EOI" then None
  else if starts_with ~prefix:"IDENT \"" symbol then
    Option.map (fun text -> Literal text) (quoted_string symbol)
  else if symbol.[0] = '"' then
    Option.map (fun text -> Literal text) (quoted_string symbol)
  else Some (Hole (hole_name symbol))

let rec production_variants production =
  let append variants suffixes =
    List.concat_map (fun prefix ->
        List.map (fun suffix -> prefix @ suffix) suffixes) variants
  in
  split_top_level ';' production
  |> List.fold_left (fun variants symbol ->
      append variants (symbol_variants symbol)) [[]]

and symbol_variants symbol =
  let symbol = trim symbol in
  if starts_with ~prefix:"OPT " symbol then
    let optional = trim (String.sub symbol 4 (String.length symbol - 4)) in
    let included =
      if String.length optional >= 2 && optional.[0] = '[' &&
         optional.[String.length optional - 1] = ']' then
        let contents = String.sub optional 1 (String.length optional - 2) in
        split_top_level '|' contents |> List.concat_map production_variants
      else symbol_variants optional
    in
    [] :: included
  else
    match part_of_symbol symbol with
    | Some part -> [[part]]
    | None -> [[]]

let needs_space previous current =
  let no_space_before = ["."; ","; ";"; ")"; "]"; "}"] in
  let no_space_after = ["("; "["; "{"] in
  not (List.mem current no_space_before || List.mem previous no_space_after)

let render parts =
  let add_text buffer previous text =
    if Buffer.length buffer > 0 && needs_space previous text then Buffer.add_char buffer ' ';
    Buffer.add_string buffer text;
    text
  in
  let label = Buffer.create 64 in
  let snippet = Buffer.create 64 in
  let escape_snippet text =
    let buffer = Buffer.create (String.length text) in
    String.iter (function
        | ('\\' | '$' | '}') as character ->
          Buffer.add_char buffer '\\';
          Buffer.add_char buffer character
        | character -> Buffer.add_char buffer character) text;
    Buffer.contents buffer
  in
  let _, _, _ = List.fold_left (fun (previous_label, previous_snippet, index) part ->
      match part with
      | Literal text ->
        let previous_label = add_text label previous_label text in
        let snippet_text = escape_snippet text in
        let previous_snippet = add_text snippet previous_snippet snippet_text in
        previous_label, previous_snippet, index
      | Hole name ->
        let label_text = "<" ^ name ^ ">" in
        let snippet_text = Printf.sprintf "${%d:%s}" index (escape_snippet name) in
        let previous_label = add_text label previous_label label_text in
        let previous_snippet = add_text snippet previous_snippet snippet_text in
        previous_label, previous_snippet, index + 1)
      ("", "", 1) parts
  in
  ignore (add_text label "" ".");
  ignore (add_text snippet "" ".");
  Buffer.contents label, Buffer.contents snippet

let productions_of_printed_grammar grammar =
  production_bodies grammar
  |> List.concat_map (split_top_level '|')
  |> List.concat_map production_variants

let completions_of_printed_grammar grammar =
  productions_of_printed_grammar grammar
  |> List.filter_map (function
      | Literal _ :: _ as parts -> Some (render parts)
      | Hole _ :: _ | [] -> None)

let expand_production ?(max_depth = 16) ?(max_results = 32) productions production =
  let results = ref [] in
  let result_count = ref 0 in
  let emit reversed =
    if !result_count < max_results then begin
      incr result_count;
      results := List.rev reversed :: !results
    end
  in
  let rec expand_parts depth stack reversed parts continue =
    if !result_count >= max_results then ()
    else match parts with
    | [] -> continue reversed
    | Literal _ as part :: rest ->
      expand_parts depth stack (part :: reversed) rest continue
    | Hole name as part :: rest ->
      match CString.Map.find_opt name productions with
      | Some (_ :: _ as alternatives)
        when depth > 0 && not (List.mem name stack) ->
        List.iter (fun alternative ->
            expand_parts (depth - 1) (name :: stack) reversed alternative
              (fun reversed -> expand_parts depth stack reversed rest continue))
          alternatives
      | Some _ | None ->
        expand_parts depth stack (part :: reversed) rest continue
  in
  expand_parts max_depth [] [] production emit;
  List.rev !results

let expand_initial_hole ?(max_depth = 16) ?(max_results = 32)
    productions production =
  let results = ref [] in
  let result_count = ref 0 in
  let rec expand depth stack = function
    | Hole name :: rest when depth > 0 && not (List.mem name stack) ->
      begin match CString.Map.find_opt name productions with
      | Some alternatives ->
        List.iter (fun alternative ->
            if !result_count < max_results then
              expand (depth - 1) (name :: stack) (alternative @ rest))
          alternatives
      | None -> ()
      end
    | Literal _ :: _ as production ->
      if !result_count < max_results then begin
        incr result_count;
        results := production :: !results
      end
    | Hole _ :: _ | [] -> ()
  in
  begin match production with
  | Hole _ :: _ -> expand max_depth [] production
  | Literal _ :: _ | [] -> ()
  end;
  List.rev !results

let completion_phrases_of_productions
    ?max_depth ?max_results definitions productions =
  let max_depth = Option.default 16 max_depth in
  let max_results = Option.default 32 max_results in
  let definitions = List.fold_left (fun map (name, alternatives) ->
      CString.Map.add name alternatives map) CString.Map.empty definitions
  in
  let expand_root = function
    | Literal _ :: _ as production ->
      expand_production ~max_depth ~max_results definitions production
    | Hole _ :: _ as production ->
      let max_starters = max_results * 2 in
      let skeletons =
        expand_initial_hole ~max_depth ~max_results:max_starters definitions production
        |> List.sort_uniq compare
      in
      let quota = max 1 (max_results / max 1 (List.length skeletons)) in
      List.concat_map
        (expand_production ~max_depth ~max_results:quota definitions)
        skeletons
    | [] -> []
  in
  productions
  |> List.concat_map expand_root
  |> List.filter_map (function
      | Literal _ :: _ as production -> Some (render production)
      | Hole _ :: _ | [] -> None)
  |> List.sort_uniq compare

let print_entry entry =
  let buffer = Buffer.create 4096 in
  let formatter = Format.formatter_of_buffer buffer in
  Grammar.Entry.print formatter entry;
  Format.pp_print_flush formatter ();
  Buffer.contents buffer

[%%if rocq = "8.18" || rocq = "8.19" || rocq = "8.20"]
let reachable_grammar () =
  Grammar.Entry.accumulate_in Pvernac.Vernac_.vernac_control
[%%else]
let reachable_grammar () =
  let open Pvernac.Vernac_ in
  let proof_modes = List.map (fun (_, Pvernac.ProofMode entry) ->
      Grammar.Entry.Any entry.command_entry)
      (CString.Map.bindings (Pvernac.list_proof_modes ()))
  in
  Grammar.Entry.accumulate_in
    (Grammar.Entry.Any main_entry :: Grammar.Entry.Any noedit_mode :: proof_modes)
[%%endif]

let get_completions () =
  let grammar = reachable_grammar () in
  let productions = CString.Map.mapi (fun _ entries ->
      List.concat_map (fun (Grammar.Entry.Any entry) ->
          productions_of_printed_grammar (print_entry entry)) entries)
      grammar
  in
  let definitions = CString.Map.bindings productions in
  let roots = definitions |> List.concat_map snd in
  completion_phrases_of_productions definitions roots
  |> List.map (fun (label, insert_text) ->
      CompletionItems.mk_grammar_completion ~label ~insert_text)
